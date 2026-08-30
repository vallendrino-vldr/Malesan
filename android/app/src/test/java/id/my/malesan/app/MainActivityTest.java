package id.my.malesan.app;

import org.junit.Test;
import static org.junit.Assert.*;

public final class MainActivityTest {
    @Test public void acceptsOnlyExactMalesanAppLinks() {
        assertTrue(MainActivity.isTrustedAppUri("https://malesan.my.id/app?tab=studio"));
        assertFalse(MainActivity.isTrustedAppUri("https://malesan.my.id.evil.test/app"));
        assertFalse(MainActivity.isTrustedAppUri("http://malesan.my.id/app"));
        assertFalse(MainActivity.isTrustedAppUri("https://malesan.my.id/auth/callback"));
    }

    @Test public void extractsSupportedYouTubeSharesOnly() {
        assertEquals("https://youtu.be/dQw4w9WgXcQ?t=3", MainActivity.extractYouTubeUrl("Cek https://youtu.be/dQw4w9WgXcQ?t=3 sekarang"));
        assertEquals("https://www.youtube.com/shorts/dQw4w9WgXcQ", MainActivity.extractYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"));
        assertNull(MainActivity.extractYouTubeUrl("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"));
    }

    @Test public void acceptsOnlyPrivateNativeClipOrigin() {
        assertTrue(MainActivity.isNativeClipUri("https://appassets.androidplatform.net/native-clip/token"));
        assertFalse(MainActivity.isNativeClipUri("http://appassets.androidplatform.net/native-clip/token"));
        assertFalse(MainActivity.isNativeClipUri("https://appassets.androidplatform.net.evil.test/native-clip/token"));
        assertFalse(MainActivity.isNativeClipUri("https://appassets.androidplatform.net/assets/token"));
    }
}
