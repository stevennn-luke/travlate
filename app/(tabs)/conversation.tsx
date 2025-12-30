import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from '../utils/SafeSpeechRecognition';
import { SafeTranslate, TranslateLanguage } from '../utils/SafeTranslator';

const { width, height } = Dimensions.get('window');

const languages = [
    { code: 'en-US', mlCode: TranslateLanguage.ENGLISH, name: 'English (US)' },
    { code: 'es-ES', mlCode: TranslateLanguage.SPANISH, name: 'Spanish (Spain)' },
    { code: 'fr-FR', mlCode: TranslateLanguage.FRENCH, name: 'French (France)' },
    { code: 'de-DE', mlCode: TranslateLanguage.GERMAN, name: 'German (Germany)' },
    { code: 'it-IT', mlCode: TranslateLanguage.ITALIAN, name: 'Italian (Italy)' },
    { code: 'hi-IN', mlCode: TranslateLanguage.HINDI, name: 'Hindi' },
    { code: 'ja-JP', mlCode: TranslateLanguage.JAPANESE, name: 'Japanese' },
    { code: 'ko-KR', mlCode: TranslateLanguage.KOREAN, name: 'Korean' },
];

export default function ConversationScreen() {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSide, setRecordingSide] = useState<'left' | 'right' | null>(null);
    const [leftLang, setLeftLang] = useState(languages[1]); // Spanish
    const [rightLang, setRightLang] = useState(languages[0]); // English

    const [leftText, setLeftText] = useState('');
    const [rightText, setRightText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);

    // Animation state for the pulse effect
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    // --- Speech Recognition Events ---
    useSpeechRecognitionEvent('start', () => setIsRecording(true));
    useSpeechRecognitionEvent('end', () => {
        setIsRecording(false);
        setRecordingSide(null);
    });
    useSpeechRecognitionEvent('result', async (event: any) => {
        const transcript = event.results?.[0]?.transcript;
        if (transcript) {
            if (recordingSide === 'left') {
                setLeftText(transcript);
                handleTranslate(transcript, 'left');
            } else {
                setRightText(transcript);
                handleTranslate(transcript, 'right');
            }
        }
    });
    useSpeechRecognitionEvent('error', (event: any) => {
        console.log('Speech error:', event);
        Alert.alert('Speech Error', JSON.stringify(event));
        setIsRecording(false);
        setRecordingSide(null);
    });

    const handleTranslate = async (text: string, fromSide: 'left' | 'right') => {
        setIsTranslating(true);
        try {
            const sourceLang = fromSide === 'left' ? leftLang.mlCode : rightLang.mlCode;
            const targetLang = fromSide === 'left' ? rightLang.mlCode : leftLang.mlCode;

            const translated = await SafeTranslate({
                text: text,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                downloadModelIfNeeded: true,
            });

            if (fromSide === 'left') {
                setRightText(translated);
            } else {
                setLeftText(translated);
            }
        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            setIsTranslating(false);
        }
    };

    const startListening = async (side: 'left' | 'right') => {
        setRecordingSide(side);
        try {
            const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!result.granted) {
                Alert.alert('Permission denied', 'Microphone access is required.');
                return;
            }
            const langCode = side === 'left' ? leftLang.code : rightLang.code;
            ExpoSpeechRecognitionModule.start({
                lang: langCode,
                interimResults: true,
            });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Image
                    source={require('../../assets/images/image.png')}
                    style={styles.logo}
                    contentFit="contain"
                />
            </View>
            <View style={styles.content}>

                {/* Right Bubble (English) */}
                <View style={[styles.bubbleContainer, styles.rightAlign]}>
                    <TouchableOpacity style={styles.bubble} onPress={() => startListening('right')}>
                        <View style={styles.bubbleHeader}>
                            <Text style={styles.languageText}>{rightLang.name}</Text>
                            <Ionicons name="chevron-expand" size={14} color="#999" />
                        </View>
                        <Text style={[styles.mainText, !rightText && styles.placeholderText]}>
                            {rightText || 'Enter text'}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.bubbleTailRight} />
                </View>

                {/* Left Bubble (Spanish) */}
                <View style={[styles.bubbleContainer, styles.leftAlign]}>
                    <TouchableOpacity style={styles.bubble} onPress={() => startListening('left')}>
                        <View style={styles.bubbleHeader}>
                            <Text style={[styles.languageText, { color: '#000' }]}>{leftLang.name}</Text>
                            <Ionicons name="chevron-expand" size={14} color="#999" />
                        </View>
                        <Text style={[styles.mainText, !leftText && styles.placeholderText]}>
                            {leftText || 'Introducir texto'}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.bubbleTailLeft} />
                </View>

                {/* Unified Microphone Button */}
                <View style={styles.bottomActions}>
                    <View style={styles.micShadowWrapper}>
                        <TouchableOpacity
                            style={[styles.mainMicButton, isRecording && styles.micActive]}
                            onPress={() => {
                                if (isRecording) {
                                    ExpoSpeechRecognitionModule.stop();
                                } else {
                                    // Default to right side (User)
                                    startListening('right');
                                }
                            }}
                        >
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <Ionicons name="mic" size={40} color="white" />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>

                {isTranslating && (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator color="#61D8D8" size="small" />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F8FA', // Matching the clean light grey background from the image
    },
    content: {
        flex: 1,
        justifyContent: 'center', // Bubbles staggered in the middle
        paddingHorizontal: 20,
    },
    bubbleContainer: {
        marginVertical: 15,
        position: 'relative',
        width: '100%',
    },
    leftAlign: {
        alignItems: 'flex-start',
        paddingRight: 40,
    },
    rightAlign: {
        alignItems: 'flex-end',
        paddingLeft: 40,
    },
    bubble: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 3,
    },
    bubbleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    languageText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    mainText: {
        fontSize: 22,
        fontWeight: '600',
        color: '#000',
        lineHeight: 28,
    },
    placeholderText: {
        color: '#BBB',
    },
    bubbleTailLeft: {
        position: 'absolute',
        bottom: 0,
        left: 10,
        width: 20,
        height: 20,
        backgroundColor: 'white',
        borderBottomLeftRadius: 4,
        transform: [{ rotate: '45deg' }],
        zIndex: -1,
    },
    bubbleTailRight: {
        position: 'absolute',
        bottom: 0,
        right: 10,
        width: 20,
        height: 20,
        backgroundColor: 'white',
        borderBottomRightRadius: 4,
        transform: [{ rotate: '45deg' }],
        zIndex: -1,
    },
    bottomActions: {
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    micShadowWrapper: {
        shadowColor: '#61D8D8',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    mainMicButton: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: '#61D8D8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micActive: {
        backgroundColor: '#FF3B30',
    },
    loaderContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
    },
    logo: {
        width: 140,
        height: 40,
    }
});
