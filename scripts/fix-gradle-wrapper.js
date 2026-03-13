
import { readFileSync, writeFileSync, existsSync, createWriteStream } from 'fs';
import { join } from 'path';
import https from 'https';

console.log('🔧 Fixing Gradle Wrapper compatibility...');

const wrapperPath = join('android', 'gradle', 'wrapper', 'gradle-wrapper.properties');

if (existsSync(wrapperPath)) {
    let content = readFileSync(wrapperPath, 'utf-8');
    // Upgrade to Gradle 8.12 (Latest stable) to support newer Java versions
    const newDistUrl = 'https\\://services.gradle.org/distributions/gradle-8.12-all.zip';
    
    if (content.includes('distributionUrl')) {
        content = content.replace(/distributionUrl=.*/, `distributionUrl=${newDistUrl}`);
        writeFileSync(wrapperPath, content);
        console.log('✅ Updated Gradle Wrapper to 8.12');
    } else {
        console.warn('⚠️ distributionUrl not found in gradle-wrapper.properties');
    }
} else {
    console.error('⚠️ gradle-wrapper.properties not found at:', wrapperPath);
}

const jarPath = join('android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
console.log('⬇️ Downloading fresh gradle-wrapper.jar...');
const jarUrl = 'https://raw.githubusercontent.com/gradle/gradle/v8.12.0/gradle/wrapper/gradle-wrapper.jar';

await new Promise((resolve, reject) => {
    https.get(jarUrl, (res) => {
        if (res.statusCode !== 200) {
            reject(new Error(`Failed to download jar: ${res.statusCode}`));
            return;
        }
        const file = createWriteStream(jarPath);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('✅ Downloaded fresh gradle-wrapper.jar');
            resolve();
        });
    }).on('error', reject);
});

const buildGradlePath = join('android', 'build.gradle');
if (existsSync(buildGradlePath)) {
    let content = readFileSync(buildGradlePath, 'utf-8');
    if (content.includes('com.android.tools.build:gradle:8.2.1')) {
        content = content.replace(/com\.android\.tools\.build:gradle:8\.2\.1/g, 'com.android.tools.build:gradle:8.5.0');
        writeFileSync(buildGradlePath, content);
        console.log('✅ Updated AGP version to 8.5.0 in android/build.gradle');
    } else if (content.includes('com.android.tools.build:gradle:')) {
        content = content.replace(/com\.android\.tools\.build:gradle:[0-9.]+/g, 'com.android.tools.build:gradle:8.5.0');
        writeFileSync(buildGradlePath, content);
        console.log('✅ Updated AGP version to 8.5.0 in android/build.gradle');
    }
}

const cordovaBuildGradlePath = join('android', 'capacitor-cordova-android-plugins', 'build.gradle');
if (existsSync(cordovaBuildGradlePath)) {
    let content = readFileSync(cordovaBuildGradlePath, 'utf-8');
    if (content.includes('com.android.tools.build:gradle:')) {
        content = content.replace(/com\.android\.tools\.build:gradle:[0-9.]+/g, 'com.android.tools.build:gradle:8.5.0');
        writeFileSync(cordovaBuildGradlePath, content);
        console.log('✅ Updated AGP version to 8.5.0 in android/capacitor-cordova-android-plugins/build.gradle');
    }
}
