
// This file safely imports expo-speech-recognition, providing mocks if the native module is missing (e.g. in Expo Go)
import { useEffect } from 'react';

// Simplified Event Emitter for the mock
const listeners: Record<string, Function[]> = {};

const emit = (event: string, data?: any) => {
    if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
    }
};

let ExpoSpeechRecognitionModule: any = {
    requestPermissionsAsync: async () => {
        console.log('SafeSpeechRecognition: requestPermissionsAsync (Simulation Mode)');
        return { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
    },
    start: async (options: any) => {
        console.log('SafeSpeechRecognition: start (Simulation Mode)', options);
        emit('start');

        // Simulate a result after 2 seconds for testing purposes in Expo Go
        setTimeout(() => {
            const mockResults = {
                results: [{
                    transcript: "How much does this cost?",
                    isFinal: true
                }]
            };
            emit('result', mockResults);
            emit('end');
        }, 2500);
    },
    stop: async () => {
        console.log('SafeSpeechRecognition: stop (Simulation Mode)');
        emit('end');
    },
    abort: async () => {
        console.log('SafeSpeechRecognition: abort (Simulation Mode)');
        emit('end');
    },
    getPermissionsAsync: async () => ({ granted: true, status: 'granted', canAskAgain: true, expires: 'never' }),
    supportsOnDeviceRecognition: async () => false,
};

let useSpeechRecognitionEvent: any = (eventName: string, callback: (event: any) => void) => {
    useEffect(() => {
        if (!listeners[eventName]) listeners[eventName] = [];
        listeners[eventName].push(callback);
        return () => {
            listeners[eventName] = listeners[eventName].filter(cb => cb !== callback);
        };
    }, [eventName, callback]);
};

try {
    // Attempt to require the actual module
    const realModule = require('@jamsch/expo-speech-recognition');

    if (realModule && realModule.ExpoSpeechRecognitionModule) {
        console.log('SafeSpeechRecognition: Native module found.');
        ExpoSpeechRecognitionModule = realModule.ExpoSpeechRecognitionModule;
        useSpeechRecognitionEvent = realModule.useSpeechRecognitionEvent;
    }
} catch (error) {
    console.log('SafeSpeechRecognition: Native module not found, using simulation mocks for Expo Go.');
}

export { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent };
