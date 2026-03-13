
import { exec } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const projectRoot = resolve();
const androidAppDir = join(projectRoot, 'android', 'app');
const keystorePath = join(androidAppDir, 'release.keystore');
const propertiesPath = join(projectRoot, 'android', 'keystore.properties');
const buildGradlePath = join(androidAppDir, 'build.gradle');

const ALIAS = 'halalscan-release';
const PASS = 'halal-scanner-secure-pass'; 

const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) { reject(error); return; }
            resolve(stdout);
        });
    });
};

const patchBuildGradle = () => {
    console.log('🔧 Patching android/app/build.gradle with signing config...');
    
    if (!existsSync(buildGradlePath)) {
        console.error('❌ build.gradle not found!');
        return;
    }

    let content = readFileSync(buildGradlePath, 'utf-8');
    
    // --- STEP 1: NUCLEAR CLEANUP (التنظيف الجذري) ---
    // Remove ANY existing lines that apply signing config to prevent duplication or wrong placement
    // We regex for 'signingConfig signingConfigs.release' anywhere in the file
    const cleanRegex = /^\s*signingConfig\s+signingConfigs\.release\s*$/gm;
    if (cleanRegex.test(content)) {
        console.log('🧹 Cleaning existing signingConfig entries to fix potential errors...');
        content = content.replace(cleanRegex, ''); 
    }

    // --- STEP 2: Add Keystore Loader (if missing) ---
    const loaderCode = `
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;
    if (!content.includes('def keystoreProperties = new Properties()')) {
        content = loaderCode + content;
    }

    // --- STEP 3: Add SigningConfig Definition (if missing) ---
    if (!content.includes('signingConfigs {') && content.includes('buildTypes {')) {
        const signingBlock = `
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }`;
        content = content.replace('buildTypes {', `${signingBlock}\n    buildTypes {`);
    }

    // --- STEP 4: Inject Signing Config in the CORRECT Place ---
    // Must be inside buildTypes -> release
    const buildTypesIndex = content.indexOf('buildTypes {');
    if (buildTypesIndex !== -1) {
        // Find 'release {' that comes AFTER 'buildTypes {'
        const releaseIndex = content.indexOf('release {', buildTypesIndex);
        
        if (releaseIndex !== -1) {
            const insertionPoint = releaseIndex + 'release {'.length;
            const before = content.substring(0, insertionPoint);
            const after = content.substring(insertionPoint);
            
            // Re-insert the line cleanly
            content = before + '\n            signingConfig signingConfigs.release' + after;
            console.log('✅ Injected signingConfig into Release Build Type (Correct Location).');
        } else {
            console.error('⚠️ Could not find "release {" block inside "buildTypes". Please check build.gradle manually.');
        }
    } else {
        console.error('⚠️ Could not find "buildTypes" block. Manual check required.');
    }

    writeFileSync(buildGradlePath, content);
    console.log('💾 build.gradle updated successfully.');
};

const main = async () => {
    console.log('\n🔐 Setting up Release Keystore for Google Play...\n');

    // 1. Check if keystore exists
    if (!existsSync(keystorePath)) {
        console.log('🆕 Generating new release.keystore...');
        try {
            await runCommand(`keytool -genkey -v -keystore "${keystorePath}" -alias ${ALIAS} -keyalg RSA -keysize 2048 -validity 10000 -storepass ${PASS} -keypass ${PASS} -dname "CN=Halal Scanner,O=HalalApp,C=SA"`);
            console.log('✅ Keystore created at: android/app/release.keystore');
        } catch (e) {
            console.error('❌ Failed to create keystore. Is Java installed?');
            console.error(e.message);
            process.exit(1);
        }
    } else {
        console.log('👍 release.keystore already exists.');
    }

    // 2. Create keystore.properties
    if (!existsSync(propertiesPath)) {
        const props = `storePassword=${PASS}\nkeyPassword=${PASS}\nkeyAlias=${ALIAS}\nstoreFile=release.keystore`;
        writeFileSync(propertiesPath, props);
        console.log('✅ Created android/keystore.properties');
    }

    // 3. Patch Gradle File
    patchBuildGradle();

    // 4. Extract and Print SHA-1
    console.log('\n📢 EXTRACTING RELEASE SHA-1 FINGERPRINT...');
    try {
        const stdout = await runCommand(`keytool -list -v -keystore "${keystorePath}" -alias ${ALIAS} -storepass ${PASS}`);
        const lines = stdout.split('\n');
        let sha1 = '';
        lines.forEach(line => {
            if (line.trim().startsWith('SHA1:')) sha1 = line.trim().replace('SHA1: ', '');
        });

        if (sha1) {
            console.log('\n⚠️  IMPORTANT ACTION REQUIRED ⚠️');
            console.log('====================================================');
            console.log('To make Google Sign-In work in the Play Store version,');
            console.log('you MUST add this SHA-1 to your Firebase/Google Cloud Console:');
            console.log('\n\x1b[32m%s\x1b[0m', sha1); 
            console.log('\n====================================================\n');
        }
    } catch (e) {
        console.warn('Could not extract SHA-1 automatically. Please run keytool manually.');
    }

    console.log('🚀 Ready to build App Bundle!');
};

main();
