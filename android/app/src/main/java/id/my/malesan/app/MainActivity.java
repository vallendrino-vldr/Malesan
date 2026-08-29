package id.my.malesan.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.net.URLEncoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String BASE_URL = "https://malesan.my.id";
    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive obsidian theme matching Malesan dark aesthetic
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        window.setStatusBarColor(0xFF0B0A09);
        window.setNavigationBarColor(0xFF0B0A09);

        webView = new WebView(this);
        setContentView(webView);

        initWebViewSettings();
        initWebClients();
        injectNativeBridge();

        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) {
            webView.loadUrl(BASE_URL + "/app");
            return;
        }

        String action = intent.getAction();
        String type = intent.getType();

        // YouTube Share Intent Handler
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null) {
                String ytUrl = extractYouTubeUrl(sharedText);
                if (ytUrl != null) {
                    try {
                        String targetUrl = BASE_URL + "/app?tab=studio&m=auto_clip&yt_share=" + URLEncoder.encode(ytUrl, "UTF-8");
                        webView.loadUrl(targetUrl);
                        return;
                    } catch (Exception ignored) {}
                }
            }
        }

        Uri data = intent.getData();
        if (data != null) {
            webView.loadUrl(data.toString());
        } else {
            webView.loadUrl(BASE_URL + "/app");
        }
    }

    private String extractYouTubeUrl(String text) {
        Pattern pattern = Pattern.compile("(https?://(?:www\\.)?(?:youtube\\.com/watch\\?v=[\\w-]+|youtu\\.be/[\\w-]+)[^\\s]*)");
        Matcher matcher = pattern.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void initWebViewSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Hardware Acceleration & High-FPS Smooth Rendering
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(0xFF0B0A09);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // Eliminate "Gepeng" distorted viewport scaling
        settings.setUseWideViewPort(false);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);

        // Support popups & multiple windows for Google OAuth login
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // Enable Cookies & Third-Party Cookies for Supabase + Google OAuth
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        // Clean User Agent without '; wv' to allow Google Sign-In (avoid 403 disallowed_useragent)
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null) {
            String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version/[0-9.]+\\s*", "");
            settings.setUserAgentString(cleanUa);
        }
    }

    private void initWebClients() {
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host == null) return false;

                // Keep internal app, Supabase auth, and Google OAuth inside the WebView
                if (host.contains("malesan.my.id") ||
                    host.contains("supabase.co") ||
                    host.contains("accounts.google.com") ||
                    host.contains("accounts.youtube.com") ||
                    host.contains("ssl.gstatic.com") ||
                    host.contains("googleusercontent.com") ||
                    host.contains("googleapis.com")) {
                    return false;
                }

                // External links open in default browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void injectNativeBridge() {
        webView.addJavascriptInterface(new MalesanNativeBridge(this), "MalesanNative");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public static class MalesanNativeBridge {
        private final Context context;

        public MalesanNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.1";
        }

        @JavascriptInterface
        public void haptic(String type) {
            try {
                Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        int effectType = "heavy".equalsIgnoreCase(type)
                                ? VibrationEffect.EFFECT_HEAVY_CLICK
                                : VibrationEffect.EFFECT_TICK;
                        vibrator.vibrate(VibrationEffect.createPredefined(effectType));
                    } else {
                        vibrator.vibrate(20);
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public boolean saveVideoToGallery(String base64Data, String filename) {
            try {
                byte[] videoBytes = Base64.decode(base64Data, Base64.DEFAULT);
                ContentResolver resolver = context.getContentResolver();
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.Video.Media.DISPLAY_NAME, filename != null && !filename.isEmpty() ? filename : "Malesan_Video_" + System.currentTimeMillis() + ".mp4");
                contentValues.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
                contentValues.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_DCIM + "/Malesan");

                Uri videoUri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, contentValues);
                if (videoUri != null) {
                    try (OutputStream outputStream = resolver.openOutputStream(videoUri)) {
                        if (outputStream != null) {
                            outputStream.write(videoBytes);
                            outputStream.flush();
                            Toast.makeText(context, "Video berhasil disimpan ke Galeri HP!", Toast.LENGTH_SHORT).show();
                            return true;
                        }
                    }
                }
            } catch (Exception e) {
                Toast.makeText(context, "Gagal menyimpan ke galeri: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
            return false;
        }

        @JavascriptInterface
        public String getNativeEngineCapabilities() {
            return "Native Java Stream Extractor + Scoped MediaStore DCIM/Malesan + Hardware MediaCodec";
        }

        @JavascriptInterface
        public void downloadYouTubeClip(final String url, final int startSec, final int endSec, final String title) {
            haptic("heavy");
            Toast.makeText(context, "Mengekstrak klip video YouTube...", Toast.LENGTH_SHORT).show();
            YouTubeStreamExtractor.downloadClipAsync(context, url, startSec, endSec, title, new YouTubeStreamExtractor.StreamCallback() {
                @Override
                public void onProgress(int percent, String message) {
                    final String js = "if (window.onNativeClipProgress) { window.onNativeClipProgress(" + percent + ", '" + message.replace("'", "\\'") + "'); }";
                    if (context instanceof MainActivity) {
                        ((MainActivity) context).runOnUiThread(new Runnable() {
                            @Override public void run() {
                                ((MainActivity) context).webView.evaluateJavascript(js, null);
                            }
                        });
                    }
                }

                @Override
                public void onSuccess(final String localPath, final String filename) {
                    haptic("heavy");
                    Toast.makeText(context, "Klip berhasil disimpan ke Galeri HP: " + filename, Toast.LENGTH_LONG).show();
                    final String js = "if (window.onNativeClipSuccess) { window.onNativeClipSuccess('" + localPath.replace("'", "\\'") + "', '" + filename.replace("'", "\\'") + "'); }";
                    if (context instanceof MainActivity) {
                        ((MainActivity) context).runOnUiThread(new Runnable() {
                            @Override public void run() {
                                ((MainActivity) context).webView.evaluateJavascript(js, null);
                            }
                        });
                    }
                }

                @Override
                public void onError(final String errorMessage) {
                    Toast.makeText(context, "Error: " + errorMessage, Toast.LENGTH_LONG).show();
                    final String js = "if (window.onNativeClipError) { window.onNativeClipError('" + errorMessage.replace("'", "\\'") + "'); }";
                    if (context instanceof MainActivity) {
                        ((MainActivity) context).runOnUiThread(new Runnable() {
                            @Override public void run() {
                                ((MainActivity) context).webView.evaluateJavascript(js, null);
                            }
                        });
                    }
                }
            });
        }
    }
}