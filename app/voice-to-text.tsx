import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from '@jamsch/expo-speech-recognition';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const languages = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'French (France)', flag: '🇫🇷' },
  { code: 'de-DE', name: 'German (Germany)', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian (Italy)', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'ru-RU', name: 'Russian (Russia)', flag: '🇷🇺' },
  { code: 'ja-JP', name: 'Japanese (Japan)', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean (South Korea)', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'Hindi (India)', flag: '🇮🇳' },
];

export default function VoiceToTextScreen() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0]);
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Listen for speech recognition events
  useSpeechRecognitionEvent('start', () => {
    setIsRecording(true);
    console.log('Speech recognition started');
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
    console.log('Speech recognition ended');
  });

  useSpeechRecognitionEvent('result', (event) => {
    // Get the transcribed text from the results
    const transcript = event.results[0]?.transcript || '';
    setTranscribedText(transcript);
    console.log('Transcribed:', transcript, 'Is final:', event.isFinal);
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('Speech recognition error:', event.error, event.message);
    setIsRecording(false);
    Alert.alert(
      'Error',
      `Speech recognition error: ${event.message || event.error}`,
      [{ text: 'OK' }]
    );
  });

  const handleLanguageSelect = (language: typeof languages[0]) => {
    setSelectedLanguage(language);
    setShowLanguageModal(false);
  };

  const startRecording = async () => {
    try {
      // Request permissions first
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Microphone and speech recognition permissions are required.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Start speech recognition
      ExpoSpeechRecognitionModule.start({
        lang: selectedLanguage.code,
        interimResults: true, // Get results as user speaks
        maxAlternatives: 1,
        continuous: false, // Set to true for continuous recognition
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const clearText = () => {
    setTranscribedText('');
  };

  const openLanguageModal = () => {
    setShowLanguageModal(true);
  };

  const copyText = async () => {
    if (transcribedText) {
      // You'll need to install expo-clipboard: npx expo install expo-clipboard
      // import * as Clipboard from 'expo-clipboard';
      // await Clipboard.setStringAsync(transcribedText);
      Alert.alert('Copied', 'Text copied to clipboard');
    }
  };

  const shareText = async () => {
    if (transcribedText) {
      // You'll need to install expo-sharing
      Alert.alert('Share', 'Share functionality would go here');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Voice to Text</Text>
        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Language Selection */}
      <View style={styles.languageSection}>
        <TouchableOpacity 
          style={styles.languageSelector}
          onPress={openLanguageModal}
        >
          <Text style={styles.languageFlag}>{selectedLanguage.flag}</Text>
          <Text style={styles.languageText}>{selectedLanguage.name}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Text Display Area */}
      <View style={styles.textContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Transcribed text will appear here..."
          placeholderTextColor="#999"
          value={transcribedText}
          onChangeText={setTranscribedText}
          multiline
          textAlignVertical="top"
        />
        {transcribedText.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearText}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Recording Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={[styles.recordButton, isRecording && styles.recordingButton]} 
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons 
            name={isRecording ? "stop" : "mic"} 
            size={32} 
            color="white" 
          />
        </TouchableOpacity>
        <Text style={styles.recordButtonText}>
          {isRecording ? 'Stop Recording' : 'Tap to Record'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={copyText}>
          <Ionicons name="copy" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={shareText}>
          <Ionicons name="share" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="language" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Translate</Text>
        </TouchableOpacity>
      </View>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowLanguageModal(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView 
              style={styles.languageList}
              showsVerticalScrollIndicator={false}
            >
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageItem,
                    selectedLanguage.code === language.code && 
                    styles.selectedLanguageItem
                  ]}
                  onPress={() => handleLanguageSelect(language)}
                >
                  <View style={styles.languageItemContent}>
                    <Text style={styles.languageFlag}>{language.flag}</Text>
                    <Text style={styles.languageName}>{language.name}</Text>
                  </View>
                  {selectedLanguage.code === language.code && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons name="checkmark" size={20} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  menuButton: {
    padding: 8,
  },
  languageSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    flex: 1,
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 20,
    position: 'relative',
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 36,
    padding: 4,
  },
  controlsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  recordButtonText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  languageList: {
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 50,
  },
  selectedLanguageItem: {
    backgroundColor: '#f8f9fa',
  },
  languageItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  languageName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '400',
  },
  checkmarkContainer: {
    width: 24,
    alignItems: 'center',
  },
});
