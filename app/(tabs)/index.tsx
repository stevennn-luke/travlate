import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Keyboard,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    initDatabase
} from '../services/DatabaseService';
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

const CYAN_ACCENT = '#61D8D8';

export default function TranslateScreen() {
    const router = useRouter();
    const [sourceLanguage, setSourceLanguage] = useState(languages[0]);
    const [targetLanguage, setTargetLanguage] = useState(languages[1]);
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSide, setRecordingSide] = useState<'source' | 'target' | null>(null);

    // Localized Placeholders
    const getPlaceholder = (code: string) => {
        if (code.startsWith('es')) return 'Escribe algo...';
        if (code.startsWith('fr')) return 'Saisissez du texte...';
        if (code.startsWith('de')) return 'Text eingeben...';
        if (code.startsWith('it')) return 'Inserisci testo...';
        if (code.startsWith('hi')) return 'यहाँ लिखें...';
        if (code.startsWith('ja')) return 'テキストを入力...';
        if (code.startsWith('ko')) return '텍스트 입력...';
        return 'Type something...';
    };

    // Animation state
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isRecording) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
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

    // Language Picker Modal State
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [pickerType, setPickerType] = useState<'source' | 'target'>('source');

    useEffect(() => {
        initDatabase();
    }, []);

    // --- Translation Logic ---
    const performTranslation = useCallback(async (text: string, source: any, target: any) => {
        if (!text || !text.trim()) {
            setTargetText('');
            return;
        }

        setIsTranslating(true);
        try {
            const translated = await SafeTranslate({
                text: text,
                sourceLanguage: source,
                targetLanguage: target,
                downloadModelIfNeeded: true,
            });
            setTargetText(translated);
        } catch (error) {
            console.error('Translation error:', error);
            setTargetText('Translation failed.');
        } finally {
            setIsTranslating(false);
        }
    }, [setIsTranslating, setTargetText]);

    // --- Speech Recognition ---
    // Refs for speech state to avoid stale closures
    const recordingSideRef = useRef(recordingSide);
    useEffect(() => {
        recordingSideRef.current = recordingSide;
    }, [recordingSide]);

    // --- Speech Recognition Events ---
    useSpeechRecognitionEvent('start', () => setIsRecording(true));

    useSpeechRecognitionEvent('end', () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
        setRecordingSide(null);
        // Note: Translation is triggered by the live updates in 'result' 
        // via the useEffect dependency on [sourceText].
    });

    useSpeechRecognitionEvent('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript;
        const currentSide = recordingSideRef.current;

        if (transcript && currentSide) {
            if (currentSide === 'source') {
                setSourceText(transcript);
                // Trigger translation logic is handled by the useEffect watching sourceText
            } else if (currentSide === 'target') {
                setTargetText(transcript);
                // For target side, we might want to reverse translate, 
                // but for now we just populate the text as per typical behavior
                // or if we want reverse translation:
                // performTranslation(transcript, targetLanguage.mlCode, sourceLanguage.mlCode);
                // ^ CAREFUL: performTranslation updates targetText by default, 
                // so we need a separate reverse function or flags.
                // For this specific 'Translate' screen, usually mic on top is Source input.
                // If user clicks mic on bottom (Target), it usually means they are speaking the target language
                // and want it to update the target text field? 
                // Wait, the UI has Source Input (Top) and Target Output (Bottom).
                // The User removed the mic from Target and replaced with Speaker.
                // So we ONLY have Source Recording now?
                // Let's check the UI code.
                // Line 281: Mic button is in Source Section.
                // Line 334: Speaker button covers Target Section.
                // So we only really support Source recording now.
            }
        }
    });

    useSpeechRecognitionEvent('error', (event: any) => {
        console.log('Speech recognition error:', event.error);
        setIsRecording(false);
        setRecordingSide(null);
    });

    const isTogglingRef = useRef(false);

    const toggleRecording = async (side: 'source' | 'target') => {
        // Quick debounce to prevent double-tap, but don't block retries
        if (isTogglingRef.current) return;
        isTogglingRef.current = true;
        setTimeout(() => { isTogglingRef.current = false; }, 300);

        try {
            // STOP Logic - if currently recording this side
            if (isRecording && recordingSide === side) {
                ExpoSpeechRecognitionModule.stop();
                setIsRecording(false);
                // Don't clear recordingSide - let 'end' event handle it
                return;
            }

            // If recording different side, stop it first
            if (isRecording && recordingSide !== side) {
                ExpoSpeechRecognitionModule.stop();
                await new Promise(resolve => setTimeout(resolve, 250));
            }

            // START Logic
            setRecordingSide(side);

            // Permission Check
            const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!result.granted) {
                Alert.alert(
                    'Permission Required',
                    'Enable microphone access in settings.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Settings', onPress: () => Linking.openSettings() }
                    ]
                );
                setRecordingSide(null);
                return;
            }

            // Safety: Ensure fully stopped before starting
            try {
                await ExpoSpeechRecognitionModule.stop();
            } catch (e) {
                // Ignore errors from stopping when nothing is running
            }

            // Small delay to ensure clean state, then start
            await new Promise(resolve => setTimeout(resolve, 100));

            const langCode = side === 'source' ? sourceLanguage.code : targetLanguage.code;

            // Check for offline support (Safety check)
            let supportsOffline = false;
            try {
                if (typeof ExpoSpeechRecognitionModule.supportsOnDeviceRecognition === 'function') {
                    supportsOffline = await ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(langCode);
                }
            } catch (err) {
                console.warn('Error checking offline support:', err);
            }

            try {
                await ExpoSpeechRecognitionModule.start({
                    lang: langCode,
                    interimResults: true,
                    requiresOnDeviceRecognition: supportsOffline,
                });
            } catch (err) {
                console.warn('Offline/Preferred start failed, retrying with defaults:', err);
                // Fallback
                await ExpoSpeechRecognitionModule.start({
                    lang: langCode,
                    interimResults: true,
                    requiresOnDeviceRecognition: false,
                });
            }

            // Set recording state immediately after start
            setIsRecording(true);

        } catch (e) {
            console.error("Mic Error", e);
            Alert.alert("Microphone Error", "Failed to start recording.");
            setIsRecording(false);
            setRecordingSide(null);
        }
    };

    // --- Actions ---
    const swapLanguages = () => {
        const tempLang = sourceLanguage;
        setSourceLanguage(targetLanguage);
        setTargetLanguage(tempLang);

        const tempText = sourceText;
        setSourceText(targetText);
        setTargetText(tempText);
    };

    useEffect(() => {
        if (isRecording) {
            console.log('Auto-translate skipped: active recording');
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            console.log('Debounced translate call for:', sourceText);
            performTranslation(sourceText, sourceLanguage.mlCode, targetLanguage.mlCode);
        }, 350);

        return () => clearTimeout(delayDebounceFn);
    }, [sourceText, sourceLanguage.mlCode, targetLanguage.mlCode, isRecording, performTranslation]);

    const openLanguagePicker = (type: 'source' | 'target') => {
        setPickerType(type);
        setIsPickerVisible(true);
    };

    const selectLanguage = (lang: typeof languages[0]) => {
        if (pickerType === 'source') setSourceLanguage(lang);
        else setTargetLanguage(lang);
        setIsPickerVisible(false);
    };

    const speakTargetText = () => {
        if (targetText) {
            Speech.speak(targetText, { language: targetLanguage.code });
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ width: 40 }} />
                        <Image
                            source={require('../../assets/images/image.png')}
                            style={styles.logo}
                            contentFit="contain"
                        />
                        <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/profile')}>
                            <Ionicons name="person-circle-outline" size={32} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.mainCard}>
                            {/* Source Section */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <TouchableOpacity
                                        style={styles.languageSelector}
                                        onPress={() => openLanguagePicker('source')}
                                    >
                                        <Text style={styles.languageText}>{sourceLanguage.name}</Text>
                                        <Ionicons name="chevron-down" size={16} color="#666" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.micButton, isRecording && recordingSide === 'source' && styles.micActive]}
                                        onPress={() => toggleRecording('source')}
                                    >
                                        <Animated.View style={isRecording && recordingSide === 'source' && { transform: [{ scale: pulseAnim }] }}>
                                            <Ionicons
                                                name={isRecording && recordingSide === 'source' ? "mic" : "mic-outline"}
                                                size={24}
                                                color={isRecording && recordingSide === 'source' ? "white" : CYAN_ACCENT}
                                            />
                                        </Animated.View>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={getPlaceholder(sourceLanguage.code)}
                                        placeholderTextColor="#BBB"
                                        multiline
                                        value={sourceText}
                                        onChangeText={setSourceText}
                                        textAlignVertical="top"
                                    />
                                    <View style={styles.actionColumn}>
                                        {sourceText.length > 0 && (
                                            <TouchableOpacity onPress={() => setSourceText('')} style={styles.clearBtn}>
                                                <Ionicons name="close-circle" size={18} color="#EEE" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Separator / Swap */}
                            <View style={styles.separatorContainer}>
                                <View style={styles.separatorLine} />
                                <TouchableOpacity style={styles.swapButton} onPress={swapLanguages}>
                                    <Ionicons name="swap-vertical" size={20} color={CYAN_ACCENT} />
                                </TouchableOpacity>
                                <View style={styles.separatorLine} />
                            </View>

                            {/* Target Section */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <TouchableOpacity
                                        style={styles.languageSelector}
                                        onPress={() => openLanguagePicker('target')}
                                    >
                                        <Text style={styles.languageText}>{targetLanguage.name}</Text>
                                        <Ionicons name="chevron-down" size={16} color="#666" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.micButton}
                                        onPress={speakTargetText}
                                    >
                                        <Ionicons name="volume-high-outline" size={24} color={CYAN_ACCENT} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.inputWrapper}>
                                    <ScrollView style={{ flex: 1 }}>
                                        {isTranslating && !targetText ? (
                                            <ActivityIndicator color={CYAN_ACCENT} size="small" style={{ alignSelf: 'flex-start', marginTop: 10 }} />
                                        ) : (
                                            <Text style={[styles.targetText, !targetText && { color: '#EEE' }]}>
                                                {targetText || 'Translation will appear here...'}
                                            </Text>
                                        )}
                                    </ScrollView>
                                    <View style={styles.actionColumn}>
                                        {targetText.length > 0 && (
                                            <TouchableOpacity style={styles.clearBtn} onPress={() => { setTargetText(''); setSourceText(''); }}>
                                                <Ionicons name="trash-outline" size={18} color="#EEE" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableWithoutFeedback>

            {/* Language Picker Modal */}
            <Modal
                visible={isPickerVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsPickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsPickerVisible(false)}
                >
                    <View style={styles.pickerContainer}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Select Language</Text>
                            <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.pickerList}>
                            {languages.map((lang) => (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={styles.langOption}
                                    onPress={() => selectLanguage(lang)}
                                >
                                    <Text style={[
                                        styles.langOptionText,
                                        (pickerType === 'source' ? sourceLanguage.code === lang.code : targetLanguage.code === lang.code) && styles.langSelected
                                    ]}>
                                        {lang.name}
                                    </Text>
                                    {(pickerType === 'source' ? sourceLanguage.code === lang.code : targetLanguage.code === lang.code) && (
                                        <Ionicons name="checkmark" size={20} color={CYAN_ACCENT} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDF1F3',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    logo: {
        width: 140,
        height: 40,
    },
    profileButton: {
        padding: 4,
    },
    content: {
        paddingHorizontal: 20,
        flex: 1,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: '#333',
        marginBottom: 16,
        marginTop: 8,
    },
    mainCard: {
        backgroundColor: 'white',
        borderRadius: 32,
        padding: 24,
        minHeight: height * 0.6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    section: {
        flex: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    languageSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    languageText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '700',
    },
    offlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EDF1F3',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    offlineLabel: {
        fontSize: 10,
        color: '#999',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    inputWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flex: 1,
    },
    actionColumn: {
        alignItems: 'center',
        gap: 15,
        paddingLeft: 10,
    },
    textInput: {
        color: '#333',
        fontSize: 26,
        fontWeight: '600',
        flex: 1,
        paddingRight: 10,
        minHeight: 120,
    },
    targetText: {
        color: CYAN_ACCENT,
        fontSize: 26,
        fontWeight: '600',
        lineHeight: 34,
    },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EDF1F3',
    },
    micActive: {
        backgroundColor: '#FF3B30',
    },
    clearBtn: {
        padding: 5,
    },
    separatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#F0F0F0',
    },
    swapButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EDF1F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 15,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        backgroundColor: 'white',
        borderRadius: 24,
        width: width * 0.85,
        maxHeight: height * 0.7,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    pickerList: {
        flexGrow: 0,
    },
    langOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F5F5F5',
    },
    langOptionText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    langSelected: {
        color: CYAN_ACCENT,
        fontWeight: '700',
    },
});
