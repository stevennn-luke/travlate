import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
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

interface ChatMessage {
    id: string;
    text: string;
    translation?: string;
    side: 'left' | 'right';
}

export default function ConversationScreen() {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSide, setRecordingSide] = useState<'left' | 'right' | null>(null);

    // Languages
    const [leftLang, setLeftLang] = useState(languages[1]); // Spanish
    const [rightLang, setRightLang] = useState(languages[0]); // English

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectingSide, setSelectingSide] = useState<'left' | 'right'>('right');

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);

    // Drafting State (Typing)
    const [inputLeft, setInputLeft] = useState('');
    const [inputRight, setInputRight] = useState('');
    const [draftTransLeft, setDraftTransLeft] = useState('');
    const [draftTransRight, setDraftTransRight] = useState('');

    // Animation state for the pulse effect
    const pulseAnimLeft = useRef(new Animated.Value(1)).current;
    const pulseAnimRight = useRef(new Animated.Value(1)).current;

    const flatListRef = useRef<FlatList>(null);

    // Live Translation Debounce
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (inputLeft.trim()) {
                try {
                    const t = await SafeTranslate({
                        text: inputLeft,
                        sourceLanguage: leftLang.mlCode,
                        targetLanguage: rightLang.mlCode,
                        downloadModelIfNeeded: true,
                    });
                    setDraftTransLeft(t);
                } catch (e) { }
            } else {
                setDraftTransLeft('');
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [inputLeft, leftLang, rightLang]);

    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (inputRight.trim()) {
                try {
                    const t = await SafeTranslate({
                        text: inputRight,
                        sourceLanguage: rightLang.mlCode,
                        targetLanguage: leftLang.mlCode,
                        downloadModelIfNeeded: true,
                    });
                    setDraftTransRight(t);
                } catch (e) { }
            } else {
                setDraftTransRight('');
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [inputRight, rightLang, leftLang]);


    const runPulse = (anim: Animated.Value) => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();
    };

    useEffect(() => {
        if (isRecording) {
            if (recordingSide === 'left') runPulse(pulseAnimLeft);
            else if (recordingSide === 'right') runPulse(pulseAnimRight);
        } else {
            pulseAnimLeft.setValue(1);
            pulseAnimRight.setValue(1);
        }
    }, [isRecording, recordingSide]);

    // --- Speech Recognition Events ---
    useSpeechRecognitionEvent('start', () => setIsRecording(true));
    useSpeechRecognitionEvent('end', () => {
        setIsRecording(false);
        if (currentTranscript.trim()) {
            handleFinalizeMessage(currentTranscript, recordingSide!);
        }
        setRecordingSide(null);
        setCurrentTranscript('');
    });
    useSpeechRecognitionEvent('result', (event: any) => {
        const transcript = event.results?.[0]?.transcript;
        if (transcript) {
            setCurrentTranscript(transcript);
        }
    });

    useSpeechRecognitionEvent('error', (event: any) => {
        console.log('Speech error:', event);
        setIsRecording(false);
        setRecordingSide(null);
        setCurrentTranscript('');
    });

    const handleFinalizeMessage = async (text: string, side: 'left' | 'right') => {
        // If coming from typing/draft, we might already have the translation
        // But for speech, we just have text.
        // For uniformity, we'll create the message and ensure translation.

        let initialTrans = undefined;
        // If this matches the draft, use the draft translation
        if (side === 'left' && text === inputLeft) initialTrans = draftTransLeft;
        if (side === 'right' && text === inputRight) initialTrans = draftTransRight;

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            text: text,
            side: side,
            translation: initialTrans
        };

        setMessages(prev => [...prev, newMessage]);

        // Clear drafts if matched
        if (side === 'left') { setInputLeft(''); setDraftTransLeft(''); }
        else { setInputRight(''); setDraftTransRight(''); }

        // If no translation yet (from speech), fetch it
        if (!initialTrans) {
            await handleTranslate(newMessage);
        } else {
            // Just Speak
            const speakLangCode = side === 'left' ? rightLang.code : leftLang.code;
            Speech.speak(initialTrans, { language: speakLangCode });
        }
    };

    const handleTranslate = async (msg: ChatMessage) => {
        setIsTranslating(true);
        try {
            const sourceLang = msg.side === 'left' ? leftLang.mlCode : rightLang.mlCode;
            const targetLang = msg.side === 'left' ? rightLang.mlCode : leftLang.mlCode;

            const translated = await SafeTranslate({
                text: msg.text,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                downloadModelIfNeeded: true,
            });

            // Update message
            setMessages(prev => prev.map(m =>
                m.id === msg.id ? { ...m, translation: translated } : m
            ));

            // Speak translation
            const speakLangCode = msg.side === 'left' ? rightLang.code : leftLang.code;
            Speech.speak(translated, { language: speakLangCode });

        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            setIsTranslating(false);
        }
    };

    const toggleListening = async (side: 'left' | 'right') => {
        if (isRecording && recordingSide === side) {
            ExpoSpeechRecognitionModule.stop();
            return;
        }
        setRecordingSide(side);
        setCurrentTranscript('');

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
                requiresOnDeviceRecognition: true, // Attempt to force offline mode
            });
        } catch (e) {
            console.error(e);
        }
    };

    const submitText = (side: 'left' | 'right') => {
        const text = side === 'left' ? inputLeft : inputRight;
        if (!text.trim()) return;
        handleFinalizeMessage(text, side);
        Keyboard.dismiss();
    };

    const openLanguagePicker = (side: 'left' | 'right') => {
        setSelectingSide(side);
        setModalVisible(true);
    };

    const selectLanguage = (lang: any) => {
        if (selectingSide === 'left') {
            setLeftLang(lang);
            // Clear drafts on lang change to avoid confusion
            setInputLeft(''); setDraftTransLeft('');
        } else {
            setRightLang(lang);
            setInputRight(''); setDraftTransRight('');
        }
        setModalVisible(false);
    };

    const playAudio = (text: string, langCode: string) => {
        if (text) Speech.speak(text, { language: langCode });
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isRight = item.side === 'right';
        const targetLangObj = isRight ? leftLang : rightLang;

        return (
            <View style={[styles.messageRow, isRight ? styles.rowRight : styles.rowLeft]}>
                {/* Play Button for Right Interaction (User) - Positioned LEFT of bubble */}
                {isRight && (
                    <TouchableOpacity
                        style={[styles.playButton, { marginRight: 8 }]}
                        onPress={() => {
                            Speech.stop();
                            playAudio(item.translation || item.text, targetLangObj.code);
                        }}
                    >
                        <Ionicons name="play" size={20} color="white" />
                    </TouchableOpacity>
                )}

                <View style={styles.messageBubble}>
                    <Text style={styles.msgText}>{item.text}</Text>
                    {item.translation && (
                        <>
                            <View style={styles.msgDivider} />
                            <Text style={styles.msgTranslation}>{item.translation}</Text>
                        </>
                    )}
                    {isRight ? <View style={styles.bubbleTailRight} /> : <View style={styles.bubbleTailLeft} />}
                </View>

                {/* Play Button for Left Interaction (Partner) - Positioned RIGHT of bubble */}
                {!isRight && (
                    <TouchableOpacity
                        style={[styles.playButton, { marginLeft: 8 }]}
                        onPress={() => {
                            Speech.stop();
                            playAudio(item.translation || item.text, targetLangObj.code);
                        }}
                    >
                        <Ionicons name="play" size={20} color="white" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Logo as requested */}
            <View style={styles.header}>
                <Image
                    source={require('../../assets/images/image.png')}
                    style={styles.logo}
                    contentFit="contain"
                />
            </View>

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={[...messages].reverse()}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    inverted
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                />

                {/* Input Previews (Drafting Area) */}
                <View style={styles.inputPreviewContainer}>

                    {/* Right Input (English) - Interactive */}
                    <View style={[styles.inputBubble, styles.inputRight]}>
                        <TouchableOpacity onPress={() => openLanguagePicker('right')} style={styles.langHeader}>
                            <Text style={styles.langTitle}>{rightLang.name}</Text>
                            <Ionicons name="chevron-expand" size={12} color="#999" />
                        </TouchableOpacity>

                        {isRecording && recordingSide === 'right' ? (
                            <Text style={styles.liveTranscript}>{currentTranscript || 'Listening...'}</Text>
                        ) : (
                            <View>
                                <TextInput
                                    style={styles.textInput}
                                    value={inputRight}
                                    onChangeText={setInputRight}
                                    placeholder="Enter text"
                                    placeholderTextColor="#CCC"
                                    returnKeyType="done"
                                    onSubmitEditing={() => submitText('right')}
                                    multiline
                                    maxLength={200}
                                />
                                {inputRight.length > 0 && draftTransRight ? (
                                    <Text style={styles.draftTranslation}>{draftTransRight}</Text>
                                ) : null}
                            </View>
                        )}
                        <View style={styles.bubbleTailRight} />
                    </View>

                    {/* Left Input (Spanish) - Interactive */}
                    <View style={[styles.inputBubble, styles.inputLeft]}>
                        <TouchableOpacity onPress={() => openLanguagePicker('left')} style={styles.langHeader}>
                            <Text style={styles.langTitle}>{leftLang.name}</Text>
                            <Ionicons name="chevron-expand" size={12} color="#999" />
                        </TouchableOpacity>

                        {isRecording && recordingSide === 'left' ? (
                            <Text style={styles.liveTranscript}>{currentTranscript || 'Listening...'}</Text>
                        ) : (
                            <View>
                                <TextInput
                                    style={styles.textInput}
                                    value={inputLeft}
                                    onChangeText={setInputLeft}
                                    placeholder="Introducir texto"
                                    placeholderTextColor="#CCC"
                                    returnKeyType="done"
                                    onSubmitEditing={() => submitText('left')}
                                    multiline
                                    maxLength={200}
                                />
                                {inputLeft.length > 0 && draftTransLeft ? (
                                    <Text style={styles.draftTranslation}>{draftTransLeft}</Text>
                                ) : null}
                            </View>
                        )}
                        <View style={styles.bubbleTailLeft} />
                    </View>

                </View>

                {/* Controls */}
                <View style={styles.controlsArea}>

                    {/* Left Mic */}
                    <View style={styles.controlWrapper}>
                        <TouchableOpacity
                            style={[styles.roundButton, isRecording && recordingSide === 'left' && styles.micActive]}
                            onPress={() => toggleListening('left')}
                        >
                            <Animated.View style={{ transform: [{ scale: pulseAnimLeft }] }}>
                                <Ionicons name={isRecording && recordingSide === 'left' ? "stop" : "mic"} size={28} color="white" />
                            </Animated.View>
                        </TouchableOpacity>
                        <Text style={styles.controlLabel}>{leftLang.name.split(' ')[0]}</Text>
                    </View>

                    {/* Right Mic */}
                    <View style={styles.controlWrapper}>
                        <TouchableOpacity
                            style={[styles.roundButton, isRecording && recordingSide === 'right' && styles.micActive]}
                            onPress={() => toggleListening('right')}
                        >
                            <Animated.View style={{ transform: [{ scale: pulseAnimRight }] }}>
                                <Ionicons name={isRecording && recordingSide === 'right' ? "stop" : "headset"} size={28} color="white" />
                            </Animated.View>
                        </TouchableOpacity>
                        <Text style={styles.controlLabel}>{rightLang.name.split(' ')[0]}</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Language Modal */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Language ({selectingSide === 'left' ? 'Left' : 'Right'})</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={languages}
                            keyExtractor={(item) => item.code}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.languageOption}
                                    onPress={() => selectLanguage(item)}
                                >
                                    <Text style={styles.languageOptionText}>{item.name}</Text>
                                    {((selectingSide === 'left' ? leftLang.code : rightLang.code) === item.code) &&
                                        <Ionicons name="checkmark" size={20} color="#61D8D8" />
                                    }
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    header: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
        backgroundColor: '#F2F2F7',
        zIndex: 10,
    },
    logo: {
        width: 140,
        height: 40,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        width: '100%',
    },
    rowLeft: {
        justifyContent: 'flex-start',
    },
    rowRight: {
        justifyContent: 'flex-end',
    },
    messageBubble: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        maxWidth: '80%',
        marginHorizontal: 12,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    msgText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
        marginBottom: 4,
    },
    msgDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 6,
        width: '100%',
    },
    msgTranslation: {
        fontSize: 16,
        fontWeight: '600',
        color: '#00C4CC',
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#00C4CC',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00C4CC',
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    // Bubble Tails
    bubbleTailLeft: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 15,
        height: 15,
        backgroundColor: 'white',
        borderBottomRightRadius: 20,
        zIndex: -1,
        transform: [{ rotate: '45deg' }],
        marginLeft: -6,
        marginBottom: 8,
    },
    bubbleTailRight: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 15,
        height: 15,
        backgroundColor: 'white',
        borderBottomLeftRadius: 20,
        zIndex: -1,
        transform: [{ rotate: '45deg' }],
        marginRight: -6,
        marginBottom: 8,
    },

    // Input Area
    inputPreviewContainer: {
        flexDirection: 'column',
        marginBottom: 20,
        marginTop: 10,
    },
    inputBubble: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        width: '60%',
        marginBottom: 15,
        position: 'relative',
    },
    inputRight: {
        alignSelf: 'flex-end',
    },
    inputLeft: {
        alignSelf: 'flex-start',
    },
    langHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    langTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 4,
    },
    textInput: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        minHeight: 24,
    },
    draftTranslation: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#00C4CC',
    },
    liveTranscript: {
        color: '#000',
        fontSize: 16,
        marginTop: 4,
    },
    // Controls
    controlsArea: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 65, // Increased by 10px
        gap: 20,
    },
    controlWrapper: {
        alignItems: 'center',
        width: 80, // Ensuring width for labels
    },
    roundButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#00C4CC',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00C4CC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    micActive: {
        backgroundColor: '#FF3B30',
        transform: [{ scale: 1.1 }]
    },
    controlLabel: {
        marginTop: 8,
        color: '#00C4CC',
        fontWeight: '600',
        fontSize: 12,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
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
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    languageOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    languageOptionText: {
        fontSize: 16,
        color: '#333',
    },
});
