package id.my.malesan.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebViewFeature;

import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MainActivity extends Activity {
    // The site redirects the apex domain to www, so both hosts are ours. Trusting only one of
    // them made the shell treat its own redirect target as a foreign site and kick it out to
    // the browser, which also killed the native login bridge.
    private static final String BASE_URL = "https://www.malesan.my.id";
    private static final String APEX_ORIGIN = "https://malesan.my.id";
    private static final String APP_HOST = "www.malesan.my.id";
    private static final String APEX_HOST = "malesan.my.id";

    static boolean isAppHost(String host) {
        return APP_HOST.equalsIgnoreCase(host) || APEX_HOST.equalsIgnoreCase(host);
    }
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int PROTOCOL_VERSION = 2;
    private static final Pattern YOUTUBE_URL = Pattern.compile(
            "https?://(?:www\\.|m\\.)?(?:youtube\\.com/(?:watch\\?[^\\s]*v=|shorts/)|youtu\\.be/)[A-Za-z0-9_-]{6,}[^\\s]*",
            Pattern.CASE_INSENSITIVE
    );

    private static final class GalleryUpload {
        final Uri uri;
        final OutputStream stream;
        final long expectedBytes;
        long writtenBytes;
        GalleryUpload(Uri uri, OutputStream stream, long expectedBytes) {
            this.uri = uri; this.stream = stream; this.expectedBytes = expectedBytes;
        }
    }

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, File> clipOutputs = new ConcurrentHashMap<>();
    private final Map<String, GalleryUpload> galleryUploads = new ConcurrentHashMap<>();
    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;
    private CancellationSignal authCancellation;
    private NativeClipEngine clipEngine;
    private String activeClipJobId;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        window.setStatusBarColor(0xFF0B0A09);
        window.setNavigationBarColor(0xFF0B0A09);

        webView = new WebView(this);
        clipEngine = new NativeClipEngine(this);
        setContentView(webView);
        configureWebView();
        configureOriginSafeBridge();
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction())) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String youtubeUrl = extractYouTubeUrl(sharedText);
            if (youtubeUrl != null) {
                String shareId = java.util.UUID.randomUUID().toString();
                String target = Uri.parse(BASE_URL + "/app").buildUpon()
                        .appendQueryParameter("tab", "studio")
                        .appendQueryParameter("m", "auto_clip")
                        .appendQueryParameter("yt_share", youtubeUrl)
                        .appendQueryParameter("share_id", shareId)
                        .build().toString();
                webView.loadUrl(target);
                return;
            }
        }

        Uri data = intent == null ? null : intent.getData();
        if (data != null && isTrustedAppUri(data.toString())) {
            webView.loadUrl(data.toString());
        } else {
            webView.loadUrl(BASE_URL + "/app");
        }
    }

    static boolean isTrustedAppUri(String value) {
        try {
            java.net.URI uri = new java.net.URI(value);
            String path = uri.getPath();
            return "https".equalsIgnoreCase(uri.getScheme())
                    && isAppHost(uri.getHost())
                    && path != null
                    && (path.equals("/app") || path.startsWith("/app/"));
        } catch (Exception ignored) {
            return false;
        }
    }

    static String extractYouTubeUrl(String text) {
        if (text == null) return null;
        Matcher matcher = YOUTUBE_URL.matcher(text);
        if (!matcher.find()) return null;
        try {
            java.net.URI uri = new java.net.URI(matcher.group());
            String host = uri.getHost();
            if (host == null) return null;
            host = host.toLowerCase(Locale.ROOT);
            if (!(host.equals("youtu.be") || host.equals("youtube.com") || host.endsWith(".youtube.com"))) return null;
            return uri.toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    static boolean isNativeClipUri(String value) {
        try {
            java.net.URI uri = new java.net.URI(value);
            String path = uri.getPath();
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
                    && path != null
                    && path.startsWith("/native-clip/");
        } catch (Exception ignored) {
            return false;
        }
    }

    /** Domains that the YouTube embed player and Google auth may navigate to inside iframes.
     *  These must NOT open in an external app, nor be allowed to hijack the main frame. */
    private static boolean isEmbedDomain(String host) {
        return host.equals("youtube.com") || host.endsWith(".youtube.com")
                || host.equals("youtube-nocookie.com") || host.endsWith(".youtube-nocookie.com")
                || host.equals("youtu.be")
                || host.equals("google.com") || host.endsWith(".google.com");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(0xFF0B0A09);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isNativeClipUri(uri.toString())) return false;
                if ("https".equalsIgnoreCase(uri.getScheme()) && isAppHost(uri.getHost())) return false;
                // YouTube embed iframes (preview player) and Google auth pages must stay
                // inside the WebView. Block them from hijacking the main frame without
                // opening an external app — otherwise the user "bounces" to YouTube.
                String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
                if (isEmbedDomain(host)) {
                    // Allow iframe navigations; block main-frame hijack silently.
                    return request.isForMainFrame();
                }
                if (request.isForMainFrame()) openExternal(uri);
                return true;
            }

            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!isNativeClipUri(uri.toString())) return super.shouldInterceptRequest(view, request);
                String token = uri.getLastPathSegment();
                File file = token == null ? null : clipOutputs.remove(token);
                if (file == null || !file.isFile()) return new android.webkit.WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
                try {
                    FileInputStream input = new FileInputStream(file);
                    FilterInputStream deleting = new FilterInputStream(input) {
                        @Override public void close() throws IOException {
                            try { super.close(); }
                            finally { if (!file.delete()) file.deleteOnExit(); }
                        }
                    };
                    // Echo the requesting origin: a fixed value fails the fetch whenever the page
                    // happens to be served from the other host.
                    String requestOrigin = request.getRequestHeaders() == null ? null : request.getRequestHeaders().get("Origin");
                    String allowOrigin = APEX_ORIGIN.equals(requestOrigin) ? APEX_ORIGIN : BASE_URL;
                    return new android.webkit.WebResourceResponse("video/mp4", null, 200, "OK", Map.of("Cache-Control", "no-store", "Access-Control-Allow-Origin", allowOrigin), deleting);
                } catch (Exception failure) {
                    return new android.webkit.WebResourceResponse("text/plain", "UTF-8", 500, "Read Failed", Collections.emptyMap(), null);
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                view.destroy();
                webView = null;
                recreate();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(request::deny);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileUploadCallback != null) fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (RuntimeException error) {
                    fileUploadCallback = null;
                    return false;
                }
            }
        });
    }

    @SuppressLint("RequiresFeature")
    private void configureOriginSafeBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Toast.makeText(this, "Android System WebView perlu diperbarui.", Toast.LENGTH_LONG).show();
            return;
        }
        Set<String> allowedOrigins = Set.of(BASE_URL, APEX_ORIGIN);
        WebViewCompat.addWebMessageListener(webView, "MalesanNative", allowedOrigins, this::onNativeMessage);
    }

    private void onNativeMessage(@NonNull WebView view, @NonNull WebMessageCompat message,
                                 @NonNull Uri sourceOrigin, boolean isMainFrame,
                                 @NonNull JavaScriptReplyProxy replyProxy) {
        String origin = sourceOrigin.toString();
        if (!isMainFrame || !(BASE_URL.equals(origin) || APEX_ORIGIN.equals(origin)) || message.getData() == null) return;
        try {
            JSONObject body = new JSONObject(message.getData());
            String type = body.optString("type");
            String requestId = body.optString("requestId");
            switch (type) {
                case "SHELL_HELLO":
                    reply(replyProxy, new JSONObject()
                            .put("type", "SHELL_READY")
                            .put("requestId", requestId)
                            .put("protocolVersion", PROTOCOL_VERSION)
                            .put("appVersion", BuildConfig.VERSION_NAME)
                            .put("capabilities", new org.json.JSONArray()
                                    .put("google-id-token")
                                    .put("share-youtube")
                                    .put("haptics")
                                    .put("native-auto-clip")
                                    .put("gallery-stream")
                                    .put("clipboard-paste")));
                    break;
                case "CLIPBOARD_PASTE":
                    runOnUiThread(() -> {
                        try {
                            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                            String text = "";
                            if (clipboard != null && clipboard.hasPrimaryClip()) {
                                android.content.ClipData.Item item = clipboard.getPrimaryClip().getItemAt(0);
                                if (item != null && item.getText() != null) {
                                    text = item.getText().toString();
                                }
                            }
                            reply(replyProxy, new JSONObject()
                                    .put("type", "CLIPBOARD_TEXT")
                                    .put("requestId", requestId)
                                    .put("text", text));
                        } catch (Exception e) {
                            reply(replyProxy, error(requestId, "CLIPBOARD_ERROR", "Gagal membaca clipboard."));
                        }
                    });
                    break;
                case "AUTH_GOOGLE_START":
                    startGoogleSignIn(requestId, replyProxy);
                    break;
                case "CLIP_START":
                    startNativeClip(body, requestId, replyProxy);
                    break;
                case "CLIP_CANCEL":
                    String cancelJobId = body.optString("jobId");
                    clipEngine.cancel(cancelJobId);
                    if (cancelJobId.equals(activeClipJobId)) activeClipJobId = null;
                    reply(replyProxy, terminal("CLIP_CANCELLED", requestId));
                    break;
                case "GALLERY_PREPARE":
                    prepareGallery(body, requestId, replyProxy);
                    break;
                case "GALLERY_CHUNK":
                    appendGalleryChunk(body, requestId, replyProxy);
                    break;
                case "GALLERY_COMMIT":
                    commitGallery(body, requestId, replyProxy);
                    break;
                case "HAPTIC":
                    haptic(body.optString("strength"));
                    reply(replyProxy, terminal("HAPTIC_DONE", requestId));
                    break;
                case "REMOTE_WIPE_SELF_DESTRUCT":
                    runOnUiThread(() -> {
                        try {
                            android.webkit.CookieManager.getInstance().removeAllCookies(null);
                            android.webkit.WebStorage.getInstance().deleteAllData();
                            if (webView != null) {
                                webView.clearCache(true);
                                webView.clearHistory();
                                webView.clearFormData();
                            }
                            deleteRecursive(getCacheDir());
                            deleteRecursive(getFilesDir());
                            Intent uninstallIntent = new Intent(Intent.ACTION_DELETE);
                            uninstallIntent.setData(Uri.parse("package:" + getPackageName()));
                            uninstallIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(uninstallIntent);
                            finishAffinity();
                        } catch (Exception e) {
                            finishAffinity();
                        }
                    });
                    break;
                default:
                    reply(replyProxy, error(requestId, "UNSUPPORTED_MESSAGE", "Perintah APK tidak dikenali."));
            }
        } catch (JSONException parseError) {
            reply(replyProxy, error("", "INVALID_MESSAGE", "Pesan APK tidak valid."));
        }
    }

    private void prepareGallery(JSONObject body, String requestId, JavaScriptReplyProxy replyProxy) {
        String name = body.optString("name").replaceAll("[^A-Za-z0-9._ -]", "_");
        String mime = body.optString("mimeType");
        long bytes = body.optLong("bytes", 0);
        if (name.isBlank() || name.length() > 100 || !mime.startsWith("video/") || bytes < 1024 || bytes > 2_147_483_648L) {
            reply(replyProxy, error(requestId, "INVALID_GALLERY_FILE", "Data video galeri tidak valid.")); return;
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.Video.Media.DISPLAY_NAME, name);
        values.put(MediaStore.Video.Media.MIME_TYPE, mime);
        values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_DCIM + "/Malesan");
        values.put(MediaStore.Video.Media.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("MediaStore menolak file.");
            OutputStream stream = getContentResolver().openOutputStream(uri, "w");
            if (stream == null) throw new IOException("Galeri tidak bisa ditulis.");
            String token = randomToken();
            galleryUploads.put(token, new GalleryUpload(uri, stream, bytes));
            reply(replyProxy, new JSONObject().put("type", "GALLERY_UPLOAD_READY").put("requestId", requestId).put("downloadToken", token));
        } catch (Exception failure) {
            if (uri != null) getContentResolver().delete(uri, null, null);
            reply(replyProxy, error(requestId, "GALLERY_PREPARE_FAILED", "Galeri Android gak bisa disiapkan."));
        }
    }

    private void appendGalleryChunk(JSONObject body, String requestId, JavaScriptReplyProxy replyProxy) {
        String token = body.optString("downloadToken");
        GalleryUpload upload = galleryUploads.get(token);
        try {
            byte[] chunk = Base64.getDecoder().decode(body.optString("chunk"));
            if (upload == null || chunk.length == 0 || chunk.length > 512 * 1024 || upload.writtenBytes + chunk.length > upload.expectedBytes) throw new IOException("Chunk tidak valid.");
            upload.stream.write(chunk);
            upload.writtenBytes += chunk.length;
            reply(replyProxy, terminal("GALLERY_CHUNK_ACCEPTED", requestId));
        } catch (Exception failure) {
            if (upload != null) abortGallery(token, upload);
            reply(replyProxy, error(requestId, "GALLERY_WRITE_FAILED", "Potongan video gagal ditulis."));
        }
    }

    private void commitGallery(JSONObject body, String requestId, JavaScriptReplyProxy replyProxy) {
        String token = body.optString("downloadToken");
        GalleryUpload upload = galleryUploads.remove(token);
        if (upload == null || upload.writtenBytes != upload.expectedBytes) {
            if (upload != null) abortGallery(token, upload);
            reply(replyProxy, error(requestId, "GALLERY_SIZE_MISMATCH", "Ukuran video galeri tidak cocok.")); return;
        }
        try {
            upload.stream.flush(); upload.stream.close();
            ContentValues ready = new ContentValues(); ready.put(MediaStore.Video.Media.IS_PENDING, 0);
            if (getContentResolver().update(upload.uri, ready, null, null) != 1) throw new IOException("Publish gagal.");
            reply(replyProxy, terminal("GALLERY_SAVED", requestId));
        } catch (Exception failure) {
            getContentResolver().delete(upload.uri, null, null);
            reply(replyProxy, error(requestId, "GALLERY_COMMIT_FAILED", "Video gagal diterbitkan ke Galeri."));
        }
    }

    private void abortGallery(String token, GalleryUpload upload) {
        galleryUploads.remove(token);
        try { upload.stream.close(); } catch (IOException ignored) { }
        getContentResolver().delete(upload.uri, null, null);
    }

    private void startNativeClip(JSONObject body, String requestId, JavaScriptReplyProxy replyProxy) {
        String jobId = body.optString("jobId");
        String sourceUrl = body.optString("sourceUrl");
        double start = body.optDouble("startTime", -1);
        double end = body.optDouble("endTime", -1);
        String parsedUrl = extractYouTubeUrl(sourceUrl);
        try { UUID.fromString(jobId); }
        catch (Exception invalid) { reply(replyProxy, error(requestId, "INVALID_JOB", "Job Auto Clip tidak valid.")); return; }
        if (parsedUrl == null || start < 0 || end <= start || end - start < 5 || end - start > 300) {
            reply(replyProxy, error(requestId, "INVALID_CLIP", "Rentang Auto Clip tidak valid."));
            return;
        }
        if (activeClipJobId != null) {
            reply(replyProxy, error(requestId, "CLIP_BUSY", "Satu Auto Clip masih diproses."));
            return;
        }
        activeClipJobId = jobId;
        try {
            File cookieFile = exportYouTubeCookies();
            clipEngine.start(jobId, parsedUrl, start, end, cookieFile, new NativeClipEngine.Listener() {
                @Override public void onProgress(float percent, String stage) {
                    runOnUiThread(() -> {
                        try { reply(replyProxy, new JSONObject().put("type", "CLIP_PROGRESS").put("requestId", requestId).put("progress", percent).put("stage", stage)); }
                        catch (JSONException ignored) { }
                    });
                }
                @Override public void onReady(File file) {
                    runOnUiThread(() -> {
                        activeClipJobId = null;
                        String token = randomToken();
                        clipOutputs.put(token, file);
                        try {
                            reply(replyProxy, new JSONObject().put("type", "CLIP_READY").put("requestId", requestId)
                                    .put("downloadUrl", "https://appassets.androidplatform.net/native-clip/" + token)
                                    .put("downloadToken", token).put("outputBytes", file.length()));
                        } catch (JSONException ignored) { }
                    });
                }
                @Override public void onError(String message) {
                    runOnUiThread(() -> { activeClipJobId = null; reply(replyProxy, error(requestId, "CLIP_FAILED", message)); });
                }
            });
        } catch (Throwable failure) {
            activeClipJobId = null;
            reply(replyProxy, error(requestId, "CLIP_FAILED", failure.getMessage() == null ? "Gagal memproses clip." : failure.getMessage()));
        }
    }

    private File exportYouTubeCookies() {
        try {
            CookieManager cookieManager = CookieManager.getInstance();
            String cookieStr = cookieManager.getCookie("https://www.youtube.com");
            if (cookieStr == null || cookieStr.trim().isEmpty()) {
                cookieStr = cookieManager.getCookie("https://youtube.com");
            }
            if (cookieStr == null || cookieStr.trim().isEmpty()) return null;

            File cookieFile = new File(getCacheDir(), "yt_cookies.txt");
            StringBuilder sb = new StringBuilder("# Netscape HTTP Cookie File\n");
            String[] pairs = cookieStr.split(";");
            for (String pair : pairs) {
                String[] kv = pair.trim().split("=", 2);
                if (kv.length == 2) {
                    sb.append(".youtube.com\tTRUE\t/\tTRUE\t2147483647\t")
                      .append(kv[0].trim()).append("\t")
                      .append(kv[1].trim()).append("\n");
                }
            }
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(cookieFile)) {
                fos.write(sb.toString().getBytes(StandardCharsets.UTF_8));
            }
            return cookieFile;
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "Cookie export skipped", e);
            return null;
        }
    }

    private String randomToken() {
        byte[] value = new byte[32];
        secureRandom.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private void startGoogleSignIn(String requestId, JavaScriptReplyProxy replyProxy) {
        if (requestId.isEmpty()) {
            reply(replyProxy, error(requestId, "INVALID_REQUEST", "Request ID kosong."));
            return;
        }
        if (BuildConfig.GOOGLE_WEB_CLIENT_ID.isEmpty()) {
            reply(replyProxy, error(requestId, "OAUTH_NOT_CONFIGURED", "Google Login belum dikonfigurasi."));
            return;
        }

        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        String rawNonce = Base64.getUrlEncoder().withoutPadding().encodeToString(nonceBytes);
        String hashedNonce;
        try {
            hashedNonce = hex(MessageDigest.getInstance("SHA-256").digest(rawNonce.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception impossible) {
            reply(replyProxy, error(requestId, "NONCE_FAILED", "Login tidak bisa dimulai."));
            return;
        }

        GetGoogleIdOption googleOption = new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .setNonce(hashedNonce)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(googleOption)
                .build();
        authCancellation = new CancellationSignal();
        Executor mainExecutor = command -> runOnUiThread(command);
        CredentialManager.create(this).getCredentialAsync(
                this,
                request,
                authCancellation,
                mainExecutor,
                new androidx.credentials.CredentialManagerCallback<>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        try {
                            Credential credential = result.getCredential();
                            if (!(credential instanceof CustomCredential)
                                    || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                reply(replyProxy, error(requestId, "UNEXPECTED_CREDENTIAL", "Akun Google tidak valid."));
                                return;
                            }
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            reply(replyProxy, new JSONObject()
                                    .put("type", "AUTH_GOOGLE_CREDENTIAL")
                                    .put("requestId", requestId)
                                    .put("idToken", google.getIdToken())
                                    .put("rawNonce", rawNonce));
                        } catch (Exception credentialError) {
                            reply(replyProxy, error(requestId, "CREDENTIAL_PARSE_FAILED", "Akun Google gagal dibaca."));
                        }
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException errorValue) {
                        String code = errorValue instanceof NoCredentialException ? "NO_GOOGLE_ACCOUNT" : "CREDENTIAL_CANCELLED";
                        String message = errorValue instanceof NoCredentialException ? "Akun Google tidak tersedia di perangkat." : "Pemilihan akun dibatalkan.";
                        reply(replyProxy, error(requestId, code, message));
                    }
                }
        );
    }

    private static JSONObject terminal(String type, String requestId) {
        try { return new JSONObject().put("type", type).put("requestId", requestId); }
        catch (JSONException impossible) { return new JSONObject(); }
    }

    private static JSONObject error(String requestId, String code, String message) {
        try {
            return new JSONObject().put("type", "NATIVE_ERROR").put("requestId", requestId).put("code", code).put("message", message);
        } catch (JSONException impossible) {
            return new JSONObject();
        }
    }

    @SuppressLint("RequiresFeature")
    private static void reply(JavaScriptReplyProxy proxy, JSONObject body) {
        proxy.postMessage(body.toString());
    }

    private static String hex(byte[] value) {
        StringBuilder output = new StringBuilder(value.length * 2);
        for (byte item : value) output.append(String.format(Locale.ROOT, "%02x", item));
        return output.toString();
    }

    private void haptic(String strength) {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int effect = "heavy".equalsIgnoreCase(strength) ? VibrationEffect.EFFECT_HEAVY_CLICK : VibrationEffect.EFFECT_TICK;
            vibrator.vibrate(VibrationEffect.createPredefined(effect));
        } else {
            vibrator.vibrate(VibrationEffect.createOneShot("heavy".equalsIgnoreCase(strength) ? 32 : 12, VibrationEffect.DEFAULT_AMPLITUDE));
        }
    }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (RuntimeException ignored) { Toast.makeText(this, "Tautan tidak bisa dibuka.", Toast.LENGTH_SHORT).show(); }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileUploadCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        fileUploadCallback.onReceiveValue(result);
        fileUploadCallback = null;
    }

    @Override
    protected void onDestroy() {
        if (authCancellation != null) authCancellation.cancel();
        if (activeClipJobId != null && clipEngine != null) clipEngine.cancel(activeClipJobId);
        if (clipEngine != null) clipEngine.shutdown();
        for (File file : clipOutputs.values()) if (!file.delete()) file.deleteOnExit();
        clipOutputs.clear();
        for (Map.Entry<String, GalleryUpload> entry : galleryUploads.entrySet()) abortGallery(entry.getKey(), entry.getValue());
        galleryUploads.clear();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private static void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory != null && fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursive(child);
            }
        }
        if (fileOrDirectory != null) fileOrDirectory.delete();
    }
}
