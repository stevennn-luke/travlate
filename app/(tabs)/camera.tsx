import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeOCR, SafeTranslate, TranslateLanguage } from '../utils/SafeTranslator';

const { width, height } = Dimensions.get('window');



// Removed CROP_BOX constants in favor of dynamic state

const languages = [
    { code: 'en-US', mlCode: TranslateLanguage.ENGLISH, name: 'English' },
    { code: 'es-ES', mlCode: TranslateLanguage.SPANISH, name: 'Spanish' },
    { code: 'fr-FR', mlCode: TranslateLanguage.FRENCH, name: 'French' },
    { code: 'de-DE', mlCode: TranslateLanguage.GERMAN, name: 'German' },
    { code: 'it-IT', mlCode: TranslateLanguage.ITALIAN, name: 'Italian' },
    { code: 'ja-JP', mlCode: TranslateLanguage.JAPANESE, name: 'Japanese' },
    { code: 'ko-KR', mlCode: TranslateLanguage.KOREAN, name: 'Korean' },
];

export default function CameraScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState(false);
    const cameraRef = useRef<any>(null);

    // Image State
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [imgDimensions, setImgDimensions] = useState({ w: 1, h: 1 });

    // Workflow State
    const [step, setStep] = useState<'camera' | 'crop' | 'result'>('camera');

    // Data State
    const [extractedText, setExtractedText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [targetLanguage, setTargetLanguage] = useState(languages[1]);
    const [isLangPickerVisible, setIsLangPickerVisible] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // ScrollView Ref & State for Crop
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
    const [contentSize, setContentSize] = useState({ width: width, height: height });

    const [cropRect, setCropRect] = useState({
        x: (width - width * 0.8) / 2, // Center initial X
        y: (height - height * 0.3) / 2, // Center initial Y
        w: width * 0.8,
        h: height * 0.3,
    });

    const MIN_SIZE = 60;

    // Move Box
    const movePan = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
            setCropRect(prev => ({
                ...prev,
                x: Math.max(0, Math.min(width - prev.w, prev.x + gesture.dx * 0.5)), // Slower sensitivity for precision
                y: Math.max(0, Math.min(height - prev.h, prev.y + gesture.dy * 0.5))
            }));
            // Note: In a real app we'd accumulate delta, but for simple "move" without state lag, this jittery way 
            // works if we reset gesture or just use direct values. 
            // BETTER WAY: Use a ref for start pos or just accept the jitter for this prototype.
            // Actually, best to just not reset but we don't have access to gesture state persistence comfortably here.
            // Let's use the delta to update state, but we need to reset the gesture or tracking.
            // Since we can't easily reset gesture, we'll assume small updates. 
            // Wait, standard pan responder usage:
        },
        onPanResponderGrant: () => {
            // Store initial offset?
        }
    })).current;

    // Better Movable Implementation:
    const lastCropRect = useRef(cropRect);
    const createMoveResponder = () => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            lastCropRect.current = cropRect;
        },
        onPanResponderMove: (_, gesture) => {
            const newX = lastCropRect.current.x + gesture.dx;
            const newY = lastCropRect.current.y + gesture.dy;
            setCropRect(prev => ({
                ...prev,
                x: Math.max(0, Math.min(width - prev.w, newX)),
                y: Math.max(0, Math.min(height - prev.h, newY))
            }));
        }
    });

    const moveResponder = useRef(createMoveResponder()).current;

    // Resize Responders
    const createResizeResponder = (corner: 'TL' | 'TR' | 'BL' | 'BR') => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            lastCropRect.current = cropRect;
        },
        onPanResponderMove: (_, gesture) => {
            const prev = lastCropRect.current;
            let newX = prev.x;
            let newY = prev.y;
            let newW = prev.w;
            let newH = prev.h;

            if (corner === 'TL') {
                newX += gesture.dx;
                newY += gesture.dy;
                newW -= gesture.dx;
                newH -= gesture.dy;
            }
            if (corner === 'TR') {
                newY += gesture.dy;
                newW += gesture.dx;
                newH -= gesture.dy;
            }
            if (corner === 'BL') {
                newX += gesture.dx;
                newW -= gesture.dx;
                newH += gesture.dy;
            }
            if (corner === 'BR') {
                newW += gesture.dx;
                newH += gesture.dy;
            }

            // Min Size Constraint
            if (newW < MIN_SIZE) {
                if (corner.includes('L')) newX = prev.x + prev.w - MIN_SIZE;
                newW = MIN_SIZE;
            }
            if (newH < MIN_SIZE) {
                if (corner.includes('T')) newY = prev.y + prev.h - MIN_SIZE;
                newH = MIN_SIZE;
            }

            setCropRect({
                x: newX,
                y: newY,
                w: newW,
                h: newH
            });
        }
    });

    const resizeTL = useRef(createResizeResponder('TL')).current;
    const resizeTR = useRef(createResizeResponder('TR')).current;
    const resizeBL = useRef(createResizeResponder('BL')).current;
    const resizeBR = useRef(createResizeResponder('BR')).current;



    useEffect(() => {
        if (!permission || permission.status === 'undetermined') {
            requestPermission();
        }
    }, [permission]);

    if (!permission) return <View />;

    const takePicture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
                prepareCrop(photo.uri, photo.width, photo.height);
            } catch (error) { Alert.alert('Error', 'Failed to capture'); }
        }
    };

    const pickImage = async () => {
        try {
            // Request permission first
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please grant photo library access to select images.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
            });
            if (!result.canceled && result.assets[0]) {
                prepareCrop(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to access gallery');
        }
    };

    const prepareCrop = (uri: string, w: number, h: number) => {
        setCapturedImage(uri);
        setImgDimensions({ w, h });
        setStep('crop');
        setCropRect({ x: 50, y: 150, w: width - 100, h: 200 }); // Default box
    };

    const processImage = async (imageUri: string) => {
        setIsProcessing(true);
        setCapturedImage(imageUri);
        try {
            const text = await SafeOCR(imageUri);
            setExtractedText(text);
            await triggerKeyTranslation(text, targetLanguage.mlCode);
            setStep('result');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Processing failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const onCropScroll = (event: any) => {
        setScrollOffset(event.nativeEvent.contentOffset);
        setContentSize(event.nativeEvent.contentSize);
    };

    const processCropAndScan = async (fullImage: boolean = false) => {
        if (!capturedImage) return;
        setIsProcessing(true);

        try {
            let uriToScan = capturedImage;

            if (!fullImage) {
                // Calculate scale based on "contain" logic
                const screenRatio = width / height;
                const imageRatio = imgDimensions.w / imgDimensions.h;

                let displayedW, displayedH, startX, startY;

                if (imageRatio > screenRatio) {
                    // Limited by Width
                    displayedW = width;
                    displayedH = width / imageRatio;
                    startX = 0;
                    startY = (height - displayedH) / 2;
                } else {
                    // Limited by Height
                    displayedH = height;
                    displayedW = height * imageRatio;
                    startX = (width - displayedW) / 2;
                    startY = 0;
                }

                // Map cropRect (Screen Coords) to Image Coords
                // Relative to displayed image origin
                const relX = cropRect.x - startX;
                const relY = cropRect.y - startY;

                // Scale factor
                const scale = imgDimensions.w / displayedW;

                let finalX = relX * scale;
                let finalY = relY * scale;
                let finalW = cropRect.w * scale;
                let finalH = cropRect.h * scale;

                // Clamp
                finalX = Math.max(0, finalX);
                finalY = Math.max(0, finalY);
                if (finalX + finalW > imgDimensions.w) finalW = imgDimensions.w - finalX;
                if (finalY + finalH > imgDimensions.h) finalH = imgDimensions.h - finalY;

                const cropResult = await ImageManipulator.manipulateAsync(
                    capturedImage,
                    [{ crop: { originX: finalX, originY: finalY, width: finalW, height: finalH } }],
                    { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
                );
                uriToScan = cropResult.uri;
            }

            const text = await SafeOCR(uriToScan);
            setExtractedText(text);
            await triggerKeyTranslation(text, targetLanguage.mlCode);

            setStep('result');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Processing failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const triggerKeyTranslation = async (text: string, targetCode: any) => {
        if (!text || text.trim().length === 0) {
            setTranslatedText('');
            return;
        }
        try {
            const trans = await SafeTranslate({
                text: text,
                sourceLanguage: TranslateLanguage.ENGLISH,
                targetLanguage: targetCode,
                downloadModelIfNeeded: true,
            });
            setTranslatedText(trans);
        } catch (e) { setTranslatedText('Translation Error'); }
    };

    const handleLanguageChange = (lang: typeof languages[0]) => {
        setTargetLanguage(lang);
        setIsLangPickerVisible(false);
        if (extractedText) {
            setIsProcessing(true);
            triggerKeyTranslation(extractedText, lang.mlCode).then(() => setIsProcessing(false));
        }
    };

    const reset = () => {
        setCapturedImage(null);
        setExtractedText('');
        setTranslatedText('');
        setStep('camera');
    };

    return (
        <View style={styles.container}>
            {/* 1. CAMERA */}
            {step === 'camera' && (
                <CameraView style={styles.camera} facing={facing} ref={cameraRef} enableTorch={flash}>
                    <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
                        <View style={styles.topRow}>
                            <TouchableOpacity style={styles.iconButton} onPress={() => setFlash(!flash)}>
                                <Ionicons name={flash ? "flash" : "flash-off"} size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        {/* Frame Guide Removed */}
                        <View style={{ flex: 1 }} />

                        <View style={styles.bottomRow}>
                            <TouchableOpacity style={styles.iconCircle} onPress={pickImage}>
                                <Ionicons name="images" size={26} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                                <View style={styles.captureInner} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconCircle} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
                                <Ionicons name="camera-reverse" size={26} color="white" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </CameraView>
            )}

            {/* 2. CROP */}
            {step === 'crop' && capturedImage && (
                <View style={styles.cropContainer}>
                    {/* Static Image with Movable Overlay */}
                    <View style={{ flex: 1, backgroundColor: 'black' }}>
                        <Image
                            source={{ uri: capturedImage }}
                            style={{ width: width, height: height, resizeMode: 'contain' }}
                        />
                        {/* Overlay */}
                        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                            {/* Dimmed Areas constructed around the hole */}
                            {/* Top Dim */}
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropRect.y, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                            {/* Bottom Dim */}
                            <View style={{ position: 'absolute', top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                            {/* Left Dim */}
                            <View style={{ position: 'absolute', top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                            {/* Right Dim */}
                            <View style={{ position: 'absolute', top: cropRect.y, left: cropRect.x + cropRect.w, right: 0, height: cropRect.h, backgroundColor: 'rgba(0,0,0,0.6)' }} />

                            {/* The Highlight Box */}
                            <Animated.View
                                style={[styles.highlightBox, {
                                    left: cropRect.x,
                                    top: cropRect.y,
                                    width: cropRect.w,
                                    height: cropRect.h,
                                    position: 'absolute'
                                }]}
                                {...moveResponder.panHandlers}
                            >
                                <View style={[styles.corner, styles.topLeft]} {...resizeTL.panHandlers} />
                                <View style={[styles.corner, styles.topRight]} {...resizeTR.panHandlers} />
                                <View style={[styles.corner, styles.bottomLeft]} {...resizeBL.panHandlers} />
                                <View style={[styles.corner, styles.bottomRight]} {...resizeBR.panHandlers} />
                            </Animated.View>
                        </View>
                    </View>

                    <View style={styles.instructionPill}>
                        <Text style={styles.instructionText}>Zoom/Move to crop</Text>
                    </View>

                    {/* Controls */}
                    <View style={styles.cropActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
                            <Text style={styles.secondaryBtnText}>Retake</Text>
                        </TouchableOpacity>



                        <TouchableOpacity style={styles.primaryBtn} onPress={() => processCropAndScan(false)}>
                            {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Crop & Scan</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* 3. RESULT CARD (Popup) */}
            {step === 'result' && (
                <View style={styles.resultContainer}>
                    <Image source={{ uri: capturedImage! }} style={StyleSheet.absoluteFillObject} blurRadius={20} />
                    <View style={styles.darkOverlay} />

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Results</Text>
                        </View>

                        <ScrollView style={styles.cardBody}>
                            <Text style={styles.label}>Detected Text</Text>
                            <TextInput
                                style={styles.inputText}
                                value={extractedText}
                                onChangeText={setExtractedText}
                                multiline
                                placeholder="No text detected"
                            />

                            <View style={styles.targetRow}>
                                <Text style={styles.label}>Translate into</Text>
                                <TouchableOpacity style={styles.langPill} onPress={() => setIsLangPickerVisible(true)}>
                                    <Text style={styles.langPillText}>{targetLanguage.name}</Text>
                                    <Ionicons name="chevron-down" size={12} color="#555" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.translatedText}>
                                {translatedText || '...'}
                            </Text>
                        </ScrollView>

                        <View style={styles.cardFooter}>
                            <TouchableOpacity style={styles.outlineBtn} onPress={() => setStep('crop')}>
                                <Text style={styles.outlineBtnText}>Adjust Crop</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.doneBtn} onPress={reset}>
                                <Text style={styles.doneBtnText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Language Modal */}
            <Modal visible={isLangPickerVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerTitle}>Translate to</Text>
                        {languages.map(l => (
                            <TouchableOpacity key={l.code} style={styles.pickerOption} onPress={() => handleLanguageChange(l)}>
                                <Text style={styles.pickerOptionText}>{l.name}</Text>
                                {targetLanguage.code === l.code && <Ionicons name="checkmark" size={18} color="#61D8D8" />}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.closePickerBtn} onPress={() => setIsLangPickerVisible(false)}>
                            <Text style={styles.closePickerText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'space-between' },
    topRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 20 },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 110 },
    captureButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
    captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    frameGuideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    frameGuide: { width: width * 0.7, height: 200, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 12 },

    // CROP
    cropContainer: { flex: 1, backgroundColor: '#000' },
    scrollContent: { justifyContent: 'center', alignItems: 'center', minHeight: height },
    cropOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    dimBg: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
    highlightBox: { borderColor: '#61D8D8', borderWidth: 2, backgroundColor: 'transparent', zIndex: 10 },

    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#61D8D8', backgroundColor: 'transparent', zIndex: 20 },
    topLeft: { top: -10, left: -10, borderTopWidth: 4, borderLeftWidth: 4 },
    topRight: { top: -10, right: -10, borderTopWidth: 4, borderRightWidth: 4 },
    bottomLeft: { bottom: -10, left: -10, borderBottomWidth: 4, borderLeftWidth: 4 },
    bottomRight: { bottom: -10, right: -10, borderBottomWidth: 4, borderRightWidth: 4 },

    instructionPill: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    instructionText: { color: 'white', fontWeight: '600' },

    cropActions: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20, // Reduced from 40

        paddingBottom: 135, // Increased by 15px (110 -> 125 -> 135 to be safe)
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingTop: 20,
    },
    secondaryBtn: { padding: 10 },
    secondaryBtnText: { color: 'white', fontSize: 16 },
    primaryBtn: { backgroundColor: '#61D8D8', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    primaryBtnText: { color: 'black', fontWeight: '700', fontSize: 16 },

    // RESULT
    resultContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
    card: { width: width * 0.85, maxHeight: height * 0.7, backgroundColor: 'white', borderRadius: 24, padding: 24, elevation: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    cardTitle: { fontSize: 20, fontWeight: '700', color: '#111' },

    targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 8 },
    label: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 4, textTransform: 'uppercase' },
    langPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6 },
    langPillText: { fontSize: 13, fontWeight: '700', color: '#555' },

    cardBody: { marginBottom: 20 },
    inputText: { fontSize: 16, color: '#333', marginBottom: 15, lineHeight: 22, minHeight: 60 },
    divider: { height: 1, backgroundColor: '#EEE', marginVertical: 15 },
    translatedText: { fontSize: 18, color: '#61D8D8', fontWeight: '600', lineHeight: 24 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    outlineBtn: { padding: 10 },
    outlineBtnText: { color: '#666', fontWeight: '600' },
    doneBtn: { backgroundColor: '#61D8D8', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20 },
    doneBtnText: { color: 'white', fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    pickerContainer: { width: width * 0.8, backgroundColor: 'white', borderRadius: 20, padding: 20 },
    pickerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
    pickerOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
    pickerOptionText: { fontSize: 16, color: '#333' },
    closePickerBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
    closePickerText: { color: '#666', fontWeight: '600' },
});
