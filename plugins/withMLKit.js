const { withAppBuildGradle } = require('expo/config-plugins');

const withMLKit = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Check if we've already added the dependencies
        if (!buildGradle.includes('com.google.mlkit:translate')) {
            const dependencies = `
dependencies {
    // ML Kit Translation
    implementation 'com.google.mlkit:translate:17.0.2'
    // ML Kit Text Recognition (for OCR)
    implementation 'com.google.mlkit:text-recognition:16.0.0'
}
`;
            config.modResults.contents = buildGradle + dependencies;
        }
        return config;
    });
};

module.exports = withMLKit;
