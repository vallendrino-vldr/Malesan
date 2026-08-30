import java.util.Properties

plugins { id("com.android.application") }

val signingProperties = Properties().apply {
    val localFile = rootProject.file("signing.properties")
    if (localFile.exists()) localFile.inputStream().use(::load)
}
fun signingValue(name: String): String? = providers.environmentVariable(name).orNull ?: signingProperties.getProperty(name)

android {
    namespace = "id.my.malesan.app"
    compileSdk = 36
    defaultConfig {
        applicationId = "id.my.malesan.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 25
        versionName = "2.2.2"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"909116303474-s6ou3gifvfplgoam600926jlf46ofb9j.apps.googleusercontent.com\"")
    }
    signingConfigs {
        create("release") {
            val store = signingValue("MALESAN_ANDROID_KEYSTORE")
            val storePasswordValue = signingValue("MALESAN_ANDROID_STORE_PASSWORD")
            val keyAliasValue = signingValue("MALESAN_ANDROID_KEY_ALIAS")
            val keyPasswordValue = signingValue("MALESAN_ANDROID_KEY_PASSWORD")
            if (store != null && storePasswordValue != null && keyAliasValue != null && keyPasswordValue != null) {
                storeFile = rootProject.file(store)
                storePassword = storePasswordValue
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }
    buildTypes {
        debug { versionNameSuffix = "-debug" }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
    buildFeatures { buildConfig = true }
    packaging { jniLibs { useLegacyPackaging = true } }
    // yt-dlp ships Python + FFmpeg per ABI; a universal APK is ~200 MB and cannot be
    // committed or served. Split per ABI so each artifact stays well under 100 MB.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a")
            isUniversalApk = false
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    lint { abortOnError = true; warningsAsErrors = true; disable += setOf("OldTargetApi") }
}

dependencies {
    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.2.0")
    implementation("androidx.webkit:webkit:1.17.0")
    implementation("io.github.junkfood02.youtubedl-android:library:0.18.1")
    implementation("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    testImplementation("junit:junit:4.13.2")
}
