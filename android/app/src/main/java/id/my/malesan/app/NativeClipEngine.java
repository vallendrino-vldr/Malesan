package id.my.malesan.app;

import android.content.Context;
import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import java.io.File;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import kotlin.Unit;

final class NativeClipEngine {
    interface Listener {
        void onProgress(float percent, String stage);
        void onReady(File file);
        void onError(String message);
    }
    private final Context context;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    NativeClipEngine(Context context) { this.context = context.getApplicationContext(); }

    void start(String jobId, String sourceUrl, double startSeconds, double endSeconds, Listener listener) {
        executor.execute(() -> {
            File directory = new File(context.getCacheDir(), "native-clips");
            if (!directory.exists() && !directory.mkdirs()) { listener.onError("Storage clip tidak bisa disiapkan."); return; }
            deleteMatches(directory, jobId);
            try {
                listener.onProgress(5f, "Menyiapkan pemotong video...");
                YoutubeDL.getInstance().init(context);
                FFmpeg.getInstance().init(context);

                YoutubeDLRequest request = new YoutubeDLRequest(sourceUrl)
                        .addOption("--no-playlist")
                        .addOption("--no-part")
                        .addOption("--no-warnings")
                        .addOption("--format", "b[height<=720][ext=mp4]/18/bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best")
                        .addOption("--merge-output-format", "mp4")
                        .addOption("--download-sections", String.format(Locale.US, "*%.3f-%.3f", startSeconds, endSeconds))
                        .addOption("--force-keyframes-at-cuts")
                        .addOption("--output", new File(directory, jobId + ".%(ext)s").getAbsolutePath());

                // Run a smooth progress animator while yt-dlp/ffmpeg executes
                final java.util.concurrent.atomic.AtomicBoolean running = new java.util.concurrent.atomic.AtomicBoolean(true);
                final java.util.concurrent.atomic.AtomicInteger syntheticProgress = new java.util.concurrent.atomic.AtomicInteger(10);
                Thread progressTicker = new Thread(() -> {
                    String[] stages = new String[]{
                        "Mengunduh bagian video...",
                        "Mengambil audio & frame video...",
                        "Memotong durasi klip...",
                        "Menyatukan sinkronisasi audio...",
                        "Finishing render MP4..."
                    };
                    int stageIdx = 0;
                    while (running.get() && syntheticProgress.get() < 94) {
                        try {
                            Thread.sleep(1200);
                            if (!running.get()) break;
                            int next = Math.min(94, syntheticProgress.addAndGet(7));
                            String stageText = stages[Math.min(stageIdx++, stages.length - 1)];
                            listener.onProgress(next, stageText);
                        } catch (InterruptedException e) {
                            break;
                        }
                    }
                });
                progressTicker.setDaemon(true);
                progressTicker.start();

                YoutubeDLResponse response;
                try {
                    response = YoutubeDL.getInstance().execute(request, jobId, false, (percent, eta, line) -> {
                        if (percent > 0) {
                            syntheticProgress.set((int) Math.max(syntheticProgress.get(), percent));
                            listener.onProgress(Math.max(5f, Math.min(98f, percent)), stage(line));
                        }
                        return Unit.INSTANCE;
                    });
                } finally {
                    running.set(false);
                    progressTicker.interrupt();
                }

                if (response.getExitCode() != 0) throw new IllegalStateException("Pemrosesan video gagal (exit code: " + response.getExitCode() + ").");
                listener.onProgress(98f, "Menyelesaikan file klip...");
                File output = findOutput(directory, jobId);
                if (output == null || output.length() < 1024) throw new IllegalStateException("Hasil clip kosong.");
                listener.onProgress(100f, "Klip siap!");
                listener.onReady(output);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                deleteMatches(directory, jobId);
                android.util.Log.w("NativeClipEngine", "Clip job interrupted: " + jobId);
                listener.onError("Pemrosesan clip dibatalkan.");
            } catch (Throwable failure) {
                android.util.Log.e("NativeClipEngine", "Clip execution failed for job: " + jobId, failure);
                deleteMatches(directory, jobId);
                String msg = failure.getMessage();
                if (msg == null || msg.trim().isEmpty()) msg = failure.toString();
                listener.onError(msg);
            }
        });
    }
    void cancel(String jobId) { YoutubeDL.getInstance().destroyProcessById(jobId); }
    void shutdown() { executor.shutdownNow(); }
    private static String stage(String line) {
        if (line == null) return "Mengambil potongan video...";
        String value = line.toLowerCase(Locale.ROOT);
        if (value.contains("ffmpeg") || value.contains("merg")) return "Merapikan audio dan video...";
        if (value.contains("download")) return "Mengambil potongan video...";
        return "Memproses clip di HP...";
    }
    private static File findOutput(File directory, String jobId) {
        File[] files = directory.listFiles((dir, name) -> name.startsWith(jobId + ".") && !name.endsWith(".part"));
        if (files == null || files.length == 0) return null;
        File largest = files[0]; for (File file : files) if (file.length() > largest.length()) largest = file; return largest;
    }
    private static void deleteMatches(File directory, String jobId) {
        File[] files = directory.listFiles((dir, name) -> name.startsWith(jobId + "."));
        if (files != null) for (File file : files) if (!file.delete()) file.deleteOnExit();
    }
}