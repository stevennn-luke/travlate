import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  OCRScan,
  deleteScan,
  getScans,
  initDatabase,
  saveScan
} from './services/DatabaseService';

export default function OCRCameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<OCRScan[]>([]);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    initDatabase();
    loadHistory();
  }, []);

  const loadHistory = () => {
    const scans = getScans();
    setHistory(scans);
  };

  const handleSaveScan = () => {
    if (capturedImage && extractedText) {
      saveScan(extractedText, capturedImage);
      Alert.alert('Saved', 'Scan saved to history successfully.');
      loadHistory();
    }
  };

  const handleDeleteScan = (id: number) => {
    Alert.alert('Delete', 'Are you sure you want to delete this scan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteScan(id);
          loadHistory();
        }
      }
    ]);
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#666" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need access to your camera to take photos for OCR text extraction.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        setCapturedImage(photo.uri);
        setIsCaptured(true);
        setExtractedText(''); // Reset text
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const retakePicture = () => {
    setIsCaptured(false);
    setCapturedImage(null);
    setExtractedText('');
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setIsCaptured(true);
        setExtractedText('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const processImage = async () => {
    if (capturedImage) {
      setIsProcessing(true);
      // SIMULATED OFFLINE OCR
      // In a real Native app (not Expo Go), you would use @react-native-ml-kit/text-recognition here.
      // Since we are in Expo Go, we must simulate this or use a very heavy JS library.
      // We will simulate "Offline" behavior by not making any network requests.

      setTimeout(() => {
        setIsProcessing(false);
        const simulatedText = `[Offline Mode]\nScanned at ${new Date().toLocaleTimeString()}\n\nSample Text Detected:\n- Travel Document\n- Passport No: A1234567\n- Name: John Doe\n\n(Install Native Dev Client for real on-device ML)`;
        setExtractedText(simulatedText);

        // Auto-save after processing? Optional.
        // saveScan(simulatedText, capturedImage); 
      }, 1500);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>OCR Camera</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.historyButton} onPress={() => setShowHistory(true)}>
            <Ionicons name="time-outline" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {!isCaptured ? (
        <>
          {/* Camera View */}
          <CameraView
            style={styles.camera}
            facing={facing}
            ref={cameraRef}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.focusFrame} />
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsText}>
                  Position text within the frame and tap capture
                </Text>
              </View>
            </View>
          </CameraView>

          {/* Camera Controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImageFromGallery}>
              <Ionicons name="images" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {/* Added Spacer to balance layout if reverse button is in header, 
                but let's keep reverse button here for convenience too if preferred, 
                or just keep it in header. I'll duplicate/move logic depending on UX. 
                I'll keep a spacer here for symmetry. */}
            <View style={{ width: 50 }} />
          </View>
        </>
      ) : (
        <>
          {/* Captured Image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: capturedImage! }} style={styles.capturedImage} />
            <View style={styles.imageOverlay}>
              <TouchableOpacity style={styles.retakeButton} onPress={retakePicture}>
                <Ionicons name="refresh" size={24} color="white" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Extracted Text */}
          <View style={styles.textContainer}>
            <View style={styles.textHeader}>
              <Text style={styles.textTitle}>Extracted Text</Text>
              <View style={styles.textActions}>
                {extractedText ? (
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveScan}>
                    <Ionicons name="save-outline" size={20} color="white" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.processButton, isProcessing && styles.disabledButton]}
                  onPress={processImage}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.processButtonText}>Process</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.textContent}>
              <Text style={styles.extractedText}>
                {extractedText || 'Tap "Process" to extract text from the image using offline ML.'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="copy" size={20} color="#000" />
              <Text style={styles.actionButtonText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share" size={20} color="#000" />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="language" size={20} color="#000" />
              <Text style={styles.actionButtonText}>Translate</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Scan History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={styles.closeHistoryButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={history}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.historyList}
            ListEmptyComponent={
              <Text style={styles.emptyHistoryText}>No scans saved yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Image source={{ uri: item.imageUri }} style={styles.historyImage} />
                <View style={styles.historyContent}>
                  <Text style={styles.historyText} numberOfLines={2}>{item.text}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteScan(item.id)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  historyButton: {
    padding: 8,
  },
  flipButton: {
    padding: 8,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 280,
    height: 180,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 150,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#000',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  capturedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  imageOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retakeButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '500',
  },
  textContainer: {
    backgroundColor: 'white',
    padding: 20,
    height: 240,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  textTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  textActions: {
    flexDirection: 'row',
    gap: 10,
  },
  processButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  processButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  textContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  extractedText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#000',
    marginTop: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'white',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#000',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonText: {
    color: '#000',
    fontSize: 16,
  },
  // History Modal Styles
  historyContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeHistoryButton: {
    padding: 4,
  },
  historyList: {
    padding: 16,
  },
  emptyHistoryText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  historyImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  historyContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  historyText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
  },
});
