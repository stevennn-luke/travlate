import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
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

// Dimensions for the fixed highlight box
const CROP_BOX_WIDTH = width * 0.8;
const CROP_BOX_HEIGHT = 200;

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
    const [targetLanguage, setTargetLanguage] = useState(languages[1]); // Spanish Default
    const [isLangPickerVisible, setIsLangPickerVisible] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // ScrollView Ref & State for Crop
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
    const [contentSize, setContentSize] = useState({ width: width, height: height }); // Default to screen
    const [zoomScale, setZoomScale] = useState(1);

    if (!permission) return <View />;
    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.centerContent}>
                <Text style={{ color: 'white' }}>Need Permission</Text>
                <TouchableOpacity onPress={requestPermission}><Text style={{ color: 'cyan' }}>Grant</Text></TouchableOpacity>
            </SafeAreaView>
        );
    }

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
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
            if (!result.canceled && result.assets[0]) {
                prepareCrop(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
            }
        } catch (error) { }
    };

    const prepareCrop = (uri: string, w: number, h: number) => {
        setCapturedImage(uri);
        setImgDimensions({ w, h });
        setStep('crop');
        // Reset crop state
        setZoomScale(1);
        setScrollOffset({ x: 0, y: 0 });
    };

    const onCropScroll = (event: any) => {
        setScrollOffset(event.nativeEvent.contentOffset);
        setContentSize(event.nativeEvent.contentSize);
        // Estimate zoom scale from content width (assuming standard vertical scrol view keeps Aspect Ratio)
        // Image rendered width is contentSize.width
        // But we need to know the 'base' rendered width (at zoom 1).
        // For simplicity, we calculate scale based on the Base Display Width.
    };

    const processCropAndScan = async () => {
        if (!capturedImage) return;
        setIsProcessing(true);

        try {
            // CROP LOGIC
            // 1. Determine Displayed Image Dimensions at Zoom 1
            const screenRatio = width / height;
            const imgRatio = imgDimensions.w / imgDimensions.h;

            let displayW, displayH;

            // We use 'contain' logic for the base image
            if (imgRatio > screenRatio) {
                // Wide image: Fits Width
                displayW = width;
                displayH = width / imgRatio;
            } else {
                // Tall image: Fits Height
                displayH = height;
                displayW = height * imgRatio;
            }

            // 2. Current Zoom Scale
            // contentSize.width is the current width of the image in the scrollview
            // Zoom Scale = contentSize.width / displayW
            const currentScale = contentSize.width / displayW;

            // 3. View Window Coords (Where the Highlight Box is on Screen)
            // It is centered.
            const boxX = (width - CROP_BOX_WIDTH) / 2;
            const boxY = (height - CROP_BOX_HEIGHT) / 2;

            // 4. Map to Image relative coords
            // The Image is shifted by scrollOffset AND potentially centered content offset (if looped, but here simple).
            // Actually, RN ScrollView content starts at (0,0) usually unless centered styling.
            // Our ContentContainerStyle has 'center'.

            // Let's assume content starts at (0,0) of scrollable area.
            // ScrollOffset is how much we scrolled INTO the content.
            // Coords in Content: ScrollOffset + BoxPosition

            // Wait: If content is Smaller than screen (Zoom 1, fit-contain), it is centered by Flexbox.
            // OffsetX = (Width - DisplayW)/2. 
            // This makes math hard because ScrollOffset might be 0 but image starts at x=50.

            // SIMPLIFIED APPROACH: Rely on ImageManipulator processing.
            // We calculate factor.

            // Calculate Crop Rect in "Content Space" (Zoomed pixels)
            // We need to account for the "centering" spacing if zoomed out.
            // BUT minimal zoom is 1. If Zoom 1, contentSize ~= displaySize.

            // Let's rely on standard logic:
            // Top-Left of Box relative to Content = (scrollOffset.x + boxX) - (ContentPaddingX)
            // If we assume Content fills ScrollView (Zoom >= 1), Padding is 0.

            const cropX_Zoomed = scrollOffset.x + boxX;
            const cropY_Zoomed = scrollOffset.y + boxY;

            // Normalize to Original Image Scale
            // Factor = OriginalWidth / (DisplayW * Scale)
            const scaleFactor = imgDimensions.w / contentSize.width;

            // Add Safety Margin (e.g. 20px) to capture edges better
            const margin = 20;

            let finalX = (cropX_Zoomed - margin) * scaleFactor;
            let finalY = (cropY_Zoomed - margin) * scaleFactor;
            let finalW = (CROP_BOX_WIDTH + (margin * 2)) * scaleFactor;
            let finalH = (CROP_BOX_HEIGHT + (margin * 2)) * scaleFactor;

            // Clamp
            if (finalX < 0) finalX = 0;
            if (finalY < 0) finalY = 0;
            if (finalX + finalW > imgDimensions.w) finalW = imgDimensions.w - finalX;
            if (finalY + finalH > imgDimensions.h) finalH = imgDimensions.h - finalY;

            // Perform Crop
            const cropResult = await ImageManipulator.manipulateAsync(
                capturedImage,
                [{ crop: { originX: finalX, originY: finalY, width: finalW, height: finalH } }],
                { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 5. OCR & Translate
            const text = await SafeOCR(cropResult.uri);
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
            // Basic Lang Detection or Assume English Source?
            // User requested "detected language option". SafeTranslate handles source auto? 
            // ML Kit Translate usually needs Source. Let's assume English or implement detection later.
            // For now defaults to English -> Target.
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
            // Re-translate
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
                        <View style={styles.frameGuideContainer}>
                            <View style={styles.frameGuide} />
                        </View>
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
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        maximumZoomScale={3}
                        minimumZoomScale={1}
                        onScroll={onCropScroll}
                        onContentSizeChange={(w, h) => setContentSize({ width: w, height: h })}
                        scrollEventThrottle={16}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        centerContent
                    >
                        <Image
                            source={{ uri: capturedImage }}
                            style={{
                                width: width,
                                height: width * (imgDimensions.h / imgDimensions.w),
                                resizeMode: 'contain'
                            }}
                        />
                    </ScrollView>

                    {/* Fixed Overlay */}
                    <View style={styles.cropOverlay} pointerEvents="none">
                        <View style={styles.dimBg} />
                        {/* We can't do a perfect hole easily, so we just dim everything lightly and put a bright box */}
                        <View style={styles.highlightBox}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />
                        </View>
                        <View style={styles.dimBg} />
                    </View>

                    <View style={styles.instructionPill}>
                        <Text style={styles.instructionText}>Move image to highlight text</Text>
                    </View>

                    {/* Controls - Elevated */}
                    <View style={styles.cropActions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
                            <Text style={styles.secondaryBtnText}>Retake</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.primaryBtn} onPress={processCropAndScan}>
                            {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Scan Text</Text>}
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
    highlightBox: { width: CROP_BOX_WIDTH, height: CROP_BOX_HEIGHT, borderColor: '#61D8D8', borderWidth: 2, backgroundColor: 'transparent', zIndex: 10 },

    corner: { position: 'absolute', width: 20, height: 20, borderColor: '#61D8D8', backgroundColor: 'transparent' },
    topLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
    topRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
    bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
    bottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },

    instructionPill: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    instructionText: { color: 'white', fontWeight: '600' },

    cropActions: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
        paddingBottom: 90, // Increased to avoid nav bar overlap
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
    label: { fontSize: 12, fontWeight: '700', color: '#999', marginBottom: 4, textTransform: 'uppercase' }, // Added
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
