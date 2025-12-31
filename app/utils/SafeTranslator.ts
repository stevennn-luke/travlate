import TextRecognition from '@react-native-ml-kit/text-recognition';
import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { NativeModules } from 'react-native';

const isMLKitAvailable = !!NativeModules.RNMLKitTranslateTextModule || !!NativeModules.TranslateTextModule;
const isOCRAvailable = !!NativeModules.RNMLKitTextRecognitionModule || !!NativeModules.TextRecognitionModule;

// Map ML Kit languages to ISO 639-1 for web fallback
const languageMap: Record<string, string> = {
    [TranslateLanguage.ENGLISH]: 'en',
    [TranslateLanguage.SPANISH]: 'es',
    [TranslateLanguage.FRENCH]: 'fr',
    [TranslateLanguage.GERMAN]: 'de',
    [TranslateLanguage.ITALIAN]: 'it',
    [TranslateLanguage.HINDI]: 'hi',
    [TranslateLanguage.JAPANESE]: 'ja',
    [TranslateLanguage.KOREAN]: 'ko',
    [TranslateLanguage.CHINESE]: 'zh',
};

// Fallback logic for web-based translation if native ML Kit is not linked/available in Expo Go
const translateWebFallback = async (text: string, source: string, target: string) => {
    try {
        const sl = languageMap[source] || source.split('-')[0];
        const tl = languageMap[target] || target.split('-')[0];

        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`
        );
        const data = await response.json();
        return data[0][0][0];
    } catch (e) {
        console.error('Web Fallback translation failed:', e);
        return 'Translation failed (Offline module not linked)';
    }
};

export const SafeTranslate = async (options: {
    text: string;
    sourceLanguage: any;
    targetLanguage: any;
    downloadModelIfNeeded?: boolean;
}): Promise<string> => {
    try {
        // Attempt Text Translation via usage. 
        // If native module is missing, it will throw, catching below.
        const result = await TranslateText.translate(options);
        return typeof result === 'string' ? result : (result as any).text || '';
    } catch (e: any) {
        console.warn('ML Kit Translate failed, trying fallback:', e);

        // Check if error is specifically about module missing
        if (e.message?.includes('download') || e.code === 'E_DOWNLOAD_FAILED') {
            // Return specific error for download
            return "Offline Model Missing. Please Connect to Internet.";
        }
    }

    // In Expo Go or if native fails hard, use the web fallback
    return translateWebFallback(options.text, options.sourceLanguage, options.targetLanguage);
};

export const SafeOCR = async (imageUri: string): Promise<string> => {
    try {
        // Attempt to use native OCR directly. 
        // If the module is not linked properly, this might throw or return undefined.
        const result = await TextRecognition.recognize(imageUri);
        return result.text;
    } catch (e) {
        console.warn('Native OCR failed or not available:', e);
        // Return empty string or specific error text instead of random scenarios
        return "";
    }
};

export { TranslateLanguage };
