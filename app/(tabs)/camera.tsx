import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    initDatabase,
    saveScan
} from '../services/DatabaseService';
import { SafeOCR, SafeTranslate, TranslateLanguage } from '../utils/SafeTranslator';

const { width, height } = Dimensions.get('window');

export default function CameraScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState(false);
    const cameraRef = useRef<any>(null);

    // Image/OCR State
    const [isCaptured, setIsCaptured] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    // Bottom Sheet Animation
    const bottomSheetAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        initDatabase();
    }, []);

    useEffect(() => {
        if (extractedText) {
            Animated.spring(bottomSheetAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        } else {
            Animated.timing(bottomSheetAnim, {
                toValue: height,
                duration: 300,
                useNativeDriver: true
            }).start();
        }
    }, [extractedText]);

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, styles.permissionContainer]}>
                <Ionicons name="camera-outline" size={64} color="#61D8D8" />
                <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                });
                setCapturedImage(photo.uri);
                setIsCaptured(true);
                processImage(photo.uri);
            } catch (error) {
                Alert.alert('Error', 'Failed to take picture');
            }
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                setCapturedImage(result.assets[0].uri);
                setIsCaptured(true);
                processImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const processImage = async (uri: string) => {
        setIsProcessing(true);
        setExtractedText('');
        setTranslatedText('');
        try {
            const result = await SafeOCR(uri);
            setExtractedText(result);
            // Auto translate once OCR is done if it's significant
            if (result && result.length > 3) {
                handleTranslate(result);
            }
        } catch (error) {
            console.error('OCR Error:', error);
            Alert.alert('OCR Error', 'Could not recognize text.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTranslate = async (text: string) => {
        setIsTranslating(true);
        try {
            const translated = await SafeTranslate({
                text: text,
                sourceLanguage: TranslateLanguage.ENGLISH,
                targetLanguage: TranslateLanguage.SPANISH,
                downloadModelIfNeeded: true,
            });
            setTranslatedText(translated);
        } catch (error) {
            console.error('Translation Error:', error);
        } finally {
            setIsTranslating(false);
        }
    };

    const reset = () => {
        setIsCaptured(false);
        setCapturedImage(null);
        setExtractedText('');
        setTranslatedText('');
    };

    return (
        <View style={styles.container}>
            {!isCaptured ? (
                <CameraView
                    style={styles.camera}
                    facing={facing}
                    ref={cameraRef}
                    enableTorch={flash}
                >
                    <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
                        {/* Header */}
                        <View style={styles.topContainer}>
                            <View style={styles.languagePill}>
                                <Text style={styles.langText}>Auto-Detect</Text>
                                <Ionicons name="arrow-forward" size={14} color="#666" />
                                <Text style={styles.langText}>Spanish</Text>
                            </View>
                            <TouchableOpacity style={styles.iconButton} onPress={() => setFlash(!flash)}>
                                <Ionicons name={flash ? "flash" : "flash-off"} size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        {/* Framing UI */}
                        <View style={styles.frameContainer}>
                            <View style={styles.scanFrame}>
                                <View style={[styles.corner, styles.topLeft]} />
                                <View style={[styles.corner, styles.topRight]} />
                                <View style={[styles.corner, styles.bottomLeft]} />
                                <View style={[styles.corner, styles.bottomRight]} />
                            </View>
                        </View>

                        {/* Bottom Controls */}
                        <View style={styles.bottomContainer}>
                            <TouchableOpacity style={styles.iconCircle} onPress={pickImage}>
                                <Ionicons name="images" size={26} color="white" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                                <View style={styles.captureInner} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.iconCircle}
                                onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
                            >
                                <Ionicons name="camera-reverse" size={26} color="white" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </CameraView>
            ) : (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: capturedImage! }} style={styles.previewImage} />
                    {isProcessing && (
                        <View style={styles.processingOverlay}>
                            <ActivityIndicator size="large" color="#61D8D8" />
                            <Text style={styles.processingText}>Processing Image...</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.closeButton} onPress={reset}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            {/* OCR Result Bottom View */}
            <Animated.View style={[styles.resultsPanel, { transform: [{ translateY: bottomSheetAnim }] }]}>
                <View style={styles.panelHandle} />
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Scanned Results</Text>
                    <TouchableOpacity onPress={() => {
                        if (capturedImage && extractedText) {
                            saveScan(extractedText, capturedImage);
                            Alert.alert('Saved', 'Scan added to history');
                        }
                    }}>
                        <Ionicons name="bookmark-outline" size={24} color="#61D8D8" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
                    <Text style={styles.label}>Detected Text</Text>
                    <Text style={styles.extractedText}>{extractedText}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.label}>Translation (Spanish)</Text>
                    {isTranslating ? (
                        <ActivityIndicator color="#61D8D8" size="small" style={{ alignSelf: 'flex-start' }} />
                    ) : (
                        <Text style={styles.translatedText}>{translatedText || 'Translating...'}</Text>
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    topContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    languagePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    langText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    frameContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: width * 0.75,
        height: width * 0.5,
        position: 'relative',
    },
    corner: {
        position: 'absolute',
        width: 25,
        height: 25,
        borderColor: '#61D8D8',
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 10,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 10,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 10,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 10,
    },
    bottomContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 40,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: 'white',
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: 'white',
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    permissionTitle: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 20,
        textAlign: 'center',
    },
    permissionButton: {
        marginTop: 30,
        backgroundColor: '#61D8D8',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
    },
    permissionButtonText: {
        color: 'black',
        fontWeight: '700',
        fontSize: 16,
    },
    // Results Panel
    resultsPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 12,
        height: height * 0.45,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 20,
    },
    panelHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#E0E0E0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    panelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    panelTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    panelBody: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        fontWeight: '800',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    extractedText: {
        fontSize: 18,
        color: '#333',
        fontWeight: '500',
        marginBottom: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 15,
    },
    translatedText: {
        fontSize: 20,
        color: '#61D8D8',
        fontWeight: '600',
    }
});
