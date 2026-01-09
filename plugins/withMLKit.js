const { withAppBuildGradle } = require('expo/config-plugins');

const withMLKit = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;


        if (!buildGradle.includes('com.google.mlkit:translate')) {
            const dependencies = `
dependencies {
    // ML Kit Translation
    implementation 'com.google.mlkit:translate:17.0.2'
    // ML Kit Text Recognition (for OCR)
    implementation 'com.google.mlkit:text-recognition:16.0.0'
    implementation 'com.google.mlkit:text-recognition-chinese:16.0.0'
    implementation 'com.google.mlkit:text-recognition-devanagari:16.0.0'
    implementation 'com.google.mlkit:text-recognition-japanese:16.0.0'
    implementation 'com.google.mlkit:text-recognition-korean:16.0.0'

    // Firebase Authentication
    implementation platform('com.google.firebase:firebase-bom:33.7.0')
    implementation 'com.google.firebase:firebase-auth'
}
`;
            config.modResults.contents = buildGradle + dependencies;
        }
        return config;
    });
};

module.exports = withMLKit;
