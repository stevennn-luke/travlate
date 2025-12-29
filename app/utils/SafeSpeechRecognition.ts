
// This file safely imports expo-speech-recognition, providing mocks if the native module is missing (e.g. in Expo Go)
import { useEffect } from 'react';

let ExpoSpeechRecognitionModule: any = {
    requestPermissionsAsync: async () => ({ granted: false, status: 'denied', canAskAgain: true, expires: 'never' }),
    start: async () => { },
    stop: async () => { },
    abort: async () => { },
    getPermissionsAsync: async () => ({ granted: false, status: 'denied', canAskAgain: true, expires: 'never' }),
    supportsOnDeviceRecognition: async () => false,
};

let useSpeechRecognitionEvent = (eventName: string, callback: (event: any) => void) => {
    // No-op hook
    useEffect(() => { }, []);
};

try {
    // Attempt to require the actual module
    const realModule = require('expo-speech-recognition');

    // Check if the native module is actually linked/available in the runtime
    // The 'ExpoSpeechRecognitionModule' usually sits on the exported object or checking NativeModules directly
    // However, relying on the 'require' not throwing is a good first step. 
    // Often libraries throw on import if NativeModule is missing.

    if (realModule && realModule.ExpoSpeechRecognitionModule) {
        ExpoSpeechRecognitionModule = realModule.ExpoSpeechRecognitionModule;
        useSpeechRecognitionEvent = realModule.useSpeechRecognitionEvent;
    }
} catch (error) {
    console.log('SafeSpeechRecognition: Native module not found, using mocks.');
}

export { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent };
