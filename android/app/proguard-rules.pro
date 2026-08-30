-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn org.conscrypt.**

# Keep yt-dlp and ffmpeg JNI native symbols and reflection models
-keep class com.yausername.youtubedl_android.** { *; }
-keep class com.yausername.ffmpeg.** { *; }
-keep class io.github.junkfood02.youtubedl_android.** { *; }
-keep class io.github.junkfood02.ffmpeg.** { *; }

-keepclasseswithmembernames class * {
    native <methods>;
}

-dontwarn com.yausername.**
-dontwarn io.github.junkfood02.**
