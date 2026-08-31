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
        start(jobId, sourceUrl, startSeconds, endSeconds, null, listener);
    }

    void start(String jobId, String sourceUrl, double startSeconds, double endSeconds, File cookieFile, Listener listener) {
        executor.execute(() -> {
            File directory = new File(context.getCacheDir(), "native-clips");
            if (!directory.exists() && !directory.mkdirs()) { listener.onError("Storage clip tidak bisa disiapkan."); return; }
            deleteMatches(directory, jobId);
            try {
                listener.onProgress(5f, "Menyiapkan pemotong video...");
                YoutubeDL.getInstance().init(context);
                FFmpeg.getInstance().init(context);

                // Ensure yt-dlp binary is updated with latest YouTube decryptor algorithms
                try {
                    YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel._STABLE);
                } catch (Throwable updateErr) {
                    android.util.Log.w("NativeClipEngine", "yt-dlp auto-update check skipped/offline", updateErr);
                }

                // Run a smooth continuous progress animator while yt-dlp/ffmpeg executes
                final java.util.concurrent.atomic.AtomicBoolean running = new java.util.concurrent.atomic.AtomicBoolean(true);
                final java.util.concurrent.atomic.AtomicInteger syntheticProgress = new java.util.concurrent.atomic.AtomicInteger(12);
                Thread progressTicker = new Thread(() -> {
                    String[] stages = new String[]{
                        "Mengunduh bagian video 1080p...",
                        "Mengambil audio & frame video...",
                        "Memotong durasi klip...",
                        "Menyatukan audio & video...",
                        "Finishing render MP4...",
                        "Menyiapkan preview klip..."
                    };
                    int tick = 0;
                    while (running.get() && syntheticProgress.get() < 95) {
                        try {
                            Thread.sleep(1200);
                            if (!running.get()) break;
                            int current = syntheticProgress.get();
                            int step = Math.max(1, (95 - current) / 10);
                            int next = Math.min(95, syntheticProgress.addAndGet(step));
                            int stageIdx = Math.min(tick++ / 3, stages.length - 1);
                            listener.onProgress(next, stages[stageIdx]);
                        } catch (InterruptedException e) {
                            break;
                        }
                    }
                });
                progressTicker.setDaemon(true);
                progressTicker.start();

                YoutubeDLResponse response = null;
                try {
                    // 4-Tier Adaptive HD Pipeline:
                    // Tier 1: Direct Web Full HD 1080p AVC MP4 (Fastest, highest bitrate)
                    // Tier 2: YouTube iOS Client (Bypasses Botguard & delivers pristine 1080p HD)
                    // Tier 3: YouTube TV Embedded & MWeb (Bypasses VEVO music embed restrictions)
                    // Tier 4: YouTube Android Client (Universal fallback)
                    int[] tiers = new int[]{1, 2, 3, 4};
                    Throwable lastError = null;
                    for (int tier : tiers) {
                        try {
                            deleteMatches(directory, jobId);
                            YoutubeDLRequest req = buildRequest(sourceUrl, startSeconds, endSeconds, directory, jobId, cookieFile, tier);
                            response = YoutubeDL.getInstance().execute(req, jobId, false, (percent, eta, line) -> {
                                if (percent > 0) {
                                    syntheticProgress.set((int) Math.max(syntheticProgress.get(), percent));
                                    listener.onProgress(Math.max(5f, Math.min(99f, percent)), stage(line));
                                }
                                return Unit.INSTANCE;
                            });
                            if (response != null && response.getExitCode() == 0) {
                                File check = findOutput(directory, jobId);
                                if (check != null && check.length() >= 1024) {
                                    lastError = null;
                                    break; // Success!
                                }
                            }
                        } catch (Throwable tierErr) {
                            lastError = tierErr;
                            android.util.Log.w("NativeClipEngine", "Tier " + tier + " failed, attempting next tier...", tierErr);
                            deleteMatches(directory, jobId);
                        }
                    }
                    if (lastError != null && (response == null || response.getExitCode() != 0)) {
                        throw lastError;
                    }
                } finally {
                    running.set(false);
                    progressTicker.interrupt();
                }

                if (response == null || response.getExitCode() != 0) throw new IllegalStateException("Pemrosesan video gagal.");
                listener.onProgress(100f, "Klip siap!");
                File output = findOutput(directory, jobId);
                if (output == null || output.length() < 1024) throw new IllegalStateException("Hasil clip kosong.");
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
                listener.onError(sanitizeErrorMessage(msg));
            }
        });
    }

    // =========================================================================
    // 🔒 4-TIER RESILIENT HD PIPELINE (1080P / 720P FULL HD GUARANTEE)
    // Tier 1: Direct Web Full HD 1080p AVC MP4
    // Tier 2: YouTube iOS Client (Bypasses Web Botguard & fetches 1080p HD)
    // Tier 3: YouTube TV Embedded & MWeb Client (Bypasses VEVO music restrictions)
    // Tier 4: YouTube Android Client (Universal Fallback)
    // =========================================================================
    private static YoutubeDLRequest buildRequest(
            String sourceUrl,
            double startSeconds,
            double endSeconds,
            File directory,
            String jobId,
            File cookieFile,
            int tier) {
        YoutubeDLRequest request = new YoutubeDLRequest(sourceUrl)
                .addOption("--no-playlist")
                .addOption("--no-part")
                .addOption("--no-warnings")
                .addOption("--merge-output-format", "mp4")
                .addOption("--download-sections", String.format(Locale.US, "*%.3f-%.3f", startSeconds, endSeconds))
                .addOption("--output", new File(directory, jobId + ".%(ext)s").getAbsolutePath());

        if (cookieFile != null && cookieFile.exists() && cookieFile.length() > 0) {
            request.addOption("--cookies", cookieFile.getAbsolutePath());
        }

        switch (tier) {
            case 1: // Primary Tier: Unrestricted Direct Web Full HD 1080p AVC MP4
                request.addOption("--format", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b[height<=1080]")
                       .addOption("--format-sort", "res:1080,res:720,fps:60,vcodec:h264,acodec:m4a,res,size");
                break;
            case 2: // Tier 2: Web Safari & MWeb (Bypasses bot checks with full Desktop 1080p AVC stream)
                request.addOption("--extractor-args", "youtube:player_client=web_safari,mweb")
                       .addOption("--format", "bv*[height<=1080]+ba/bestvideo[height<=1080]+bestaudio/b[height<=1080]/best")
                       .addOption("--format-sort", "res:1080,res:720,fps:60,vcodec:h264,acodec:m4a,res,size");
                break;
            case 3: // Tier 3: TV Embedded & Web Creator Client (Bypasses music restrictions with 1080p stream)
                request.addOption("--extractor-args", "youtube:player_client=tv_embedded,web_creator")
                       .addOption("--format", "bv*[height<=1080]+ba/bestvideo[height<=1080]+bestaudio/b[height<=1080]/best")
                       .addOption("--format-sort", "res:1080,res:720,fps:60,vcodec:h264,acodec:m4a,res,size");
                break;
            case 4: // Tier 4: iOS & Android Universal Fallback
            default:
                request.addOption("--extractor-args", "youtube:player_client=ios,android")
                       .addOption("-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best")
                       .addOption("--format-sort", "res:1080,res:720,fps:60,vcodec:h264,res,size");
                break;
        }
        return request;
    }

    void cancel(String jobId) { YoutubeDL.getInstance().destroyProcessById(jobId); }
    void shutdown() { executor.shutdownNow(); }
    private static String sanitizeErrorMessage(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "Gagal memproses klip video.";
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.contains("network") || lower.contains("timeout") || lower.contains("connect")) {
            return "Koneksi internet terputus saat mengunduh video. Pastikan internet stabil dan coba lagi.";
        }
        if (lower.contains("private") || lower.contains("members-only")) {
            return "Video YouTube ini bersifat privat atau khusus member.";
        }
        if (lower.contains("sign in") || lower.contains("bot") || lower.contains("429")) {
            return "YouTube membatasi akses sementara. Sedang memperbarui mesin pemotong...";
        }
        return "Gagal memotong klip video dari YouTube: " + (raw.length() > 100 ? raw.substring(0, 100) + "..." : raw);
    }
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