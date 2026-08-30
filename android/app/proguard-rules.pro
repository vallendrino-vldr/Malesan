-keep class com.google.android.libraries.identity.googleid.** { *; }
-dontwarn org.conscrypt.**

# Keep yt-dlp, ffmpeg, Jackson, Apache Commons, Kotlin reflection
-keep class com.yausername.** { *; }
-keep class io.github.junkfood02.** { *; }
-keep class com.fasterxml.jackson.** { *; }
-keep class org.apache.commons.** { *; }
-keep class kotlin.** { *; }
-keep class kotlin.reflect.** { *; }

-keepattributes *Annotation*,EnclosingMethod,InnerClasses,Signature
-keepclassmembers class * {
    @com.fasterxml.jackson.annotation.* *;
}

-keepclasseswithmembernames class * {
    native <methods>;
}

-dontwarn com.yausername.**
-dontwarn io.github.junkfood02.**
-dontwarn com.fasterxml.jackson.**
-dontwarn org.apache.commons.**
