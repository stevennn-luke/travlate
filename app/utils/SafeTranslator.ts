import TextRecognition from '@react-native-ml-kit/text-recognition';
import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { NativeModules } from 'react-native';

const isMLKitAvailable = !!NativeModules.RNMLKitTranslateTextModule || !!NativeModules.TranslateTextModule;
const isOCRAvailable = !!NativeModules.RNMLKitTextRecognitionModule || !!NativeModules.TextRecognitionModule;

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

// Helper to prevent infinite hangs
const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
    ]);
};

export const SafeTranslate = async (options: {
    text: string;
    sourceLanguage: any;
    targetLanguage: any;
    downloadModelIfNeeded?: boolean;
}): Promise<string> => {
    try {
        // Try Native ML Kit with a 5s timeout
        const result = await withTimeout(
            TranslateText.translate(options),
            5000,
            null
        );

        if (result !== null) {
            return typeof result === 'string' ? result : (result as any).text || '';
        }
    } catch (e: any) {
        console.warn('ML Kit Translate failed/timed out, trying fallback:', e);

        if (e.message?.includes('download') || e.code === 'E_DOWNLOAD_FAILED') {
            return "Offline Model Missing. Please Connect to Internet.";
        }
    }

    // Fallback to Web API (also with timeout)
    return withTimeout(
        translateWebFallback(options.text, options.sourceLanguage, options.targetLanguage),
        5000,
        "Translation timed out."
    );
};

export const SafeOCR = async (imageUri: string, script?: string): Promise<string> => {
    try {
        console.log("Starting OCR for:", imageUri);
        // Wrap OCR in a timeout (10s limit)
        const result = await withTimeout(
            TextRecognition.recognize(imageUri),
            10000,
            { text: "", blocks: [] } as any // Fallback object if it times out
        );

        if (!result || !result.text) {
            console.log("OCR returned empty result");
            return "";
        }
        return result.text;
    } catch (e) {
        console.warn('Native OCR failed or not available:', e);
        return "";
    }
};

export { TranslateLanguage };
