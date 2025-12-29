import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

const languages = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish (Spain)', flag: '🇪🇸' },
  { code: 'fr', name: 'French (France)', flag: '🇫🇷' },
  { code: 'de', name: 'German (Germany)', flag: '🇩🇪' },
  { code: 'it', name: 'Italian (Italy)', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese (Portugal)', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch (Netherlands)', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian (Russia)', flag: '🇷🇺' },
];

type TranslationDictionary = {
  [key: string]: string;
};

// Offline phrasebook for fallback
const phrasebook: { [key: string]: TranslationDictionary } = {
  'en-es': {
    'can you show me the way?': '¿Puedes mostrarme el camino?',
    'hi how are you': 'Hola, ¿cómo estás?',
    'how far away is the next station': '¿Qué tan lejos está la próxima estación?',
    'where is the nearest restaurant': '¿Dónde está el restaurante más cercano?',
    'hello': 'Hola',
    'thank you': 'Gracias',
    'please': 'Por favor',
    'excuse me': 'Disculpe',
    'yes': 'Sí',
    'no': 'No',
    'goodbye': 'Adiós',
    'good morning': 'Buenos días',
    'good evening': 'Buenas tardes',
    'good night': 'Buenas noches',
  },
  'en-fr': {
    'hello': 'Bonjour',
    'thank you': 'Merci',
    'please': "S'il vous plaît",
    'excuse me': 'Excusez-moi',
    'yes': 'Oui',
    'no': 'Non',
    'goodbye': 'Au revoir',
  },
  'en-de': {
    'hello': 'Hallo',
    'thank you': 'Danke',
    'please': 'Bitte',
    'excuse me': 'Entschuldigung',
    'yes': 'Ja',
    'no': 'Nein',
  },
};

// Mock translation function - Replace with actual ONNX Runtime implementation
const translateWithAI = async (
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> => {
  // Simulate model loading and inference
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // This is where you'd use ONNX Runtime with a model like:
  // - Helsinki-NLP/opus-mt models (small, efficient)
  // - facebook/nllb-200-distilled-600M (multilingual)
  
  // For demo purposes, return a simulated translation
  const languagePair = `${sourceLang}-${targetLang}`;
  const dictionary = phrasebook[languagePair];
  
  if (dictionary && dictionary[text.toLowerCase().trim()]) {
    return dictionary[text.toLowerCase().trim()];
  }
  
  // Simulate AI translation for other phrases
  return `[AI Translation]: ${text} (${sourceLang} → ${targetLang})`;
};

export default function TextConversionScreen() {
  const router = useRouter();
  const [sourceLanguage, setSourceLanguage] = useState(languages[0]);
  const [targetLanguage, setTargetLanguage] = useState(languages[1]);
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [selectedLanguageType, setSelectedLanguageType] = useState<'source' | 'target'>('source');
  const [isTranslating, setIsTranslating] = useState(false);
  const [useAITranslation, setUseAITranslation] = useState(true);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    // Initialize translation model on component mount
    loadTranslationModel();
  }, []);

  const loadTranslationModel = async () => {
    try {
      // Here you would load the ONNX model
      // For example: await loadONNXModel('path/to/model.onnx');
      setModelLoaded(true);
    } catch (error) {
      console.error('Failed to load translation model:', error);
      Alert.alert(
        'Model Loading Failed',
        'AI translation is unavailable. Will use phrasebook fallback.'
      );
      setUseAITranslation(false);
    }
  };

  const handleLanguageSelect = (language: typeof languages[0]) => {
    if (selectedLanguageType === 'source') {
      setSourceLanguage(language);
    } else {
      setTargetLanguage(language);
    }
    setShowLanguageModal(false);
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    
    const tempText = sourceText;
    setSourceText(targetText);
    setTargetText(tempText);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      Alert.alert('Error', 'Please enter text to translate');
      return;
    }

    setIsTranslating(true);
    
    try {
      if (useAITranslation && modelLoaded) {
        // Use AI translation
        const translation = await translateWithAI(
          sourceText,
          sourceLanguage.code,
          targetLanguage.code
        );
        setTargetText(translation);
      } else {
        // Fallback to phrasebook
        const languagePair = `${sourceLanguage.code}-${targetLanguage.code}`;
        const dictionary = phrasebook[languagePair];
        
        if (!dictionary) {
          Alert.alert(
            'Not Supported',
            `Translation from ${sourceLanguage.name} to ${targetLanguage.name} is not available in phrasebook mode.`
          );
          setIsTranslating(false);
          return;
        }

        const normalizedInput = sourceText.toLowerCase().trim();
        const translation = dictionary[normalizedInput];
        
        if (translation) {
          setTargetText(translation);
        } else {
          Alert.alert(
            'Phrase Not Found',
            'This phrase is not in the offline dictionary.',
            [
              {
                text: 'Show Available Phrases',
                onPress: () => showAvailablePhrases(languagePair),
              },
              { text: 'OK' },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };

  const showAvailablePhrases = (languagePair: string) => {
    const dictionary = phrasebook[languagePair];
    if (dictionary) {
      const phrases = Object.keys(dictionary).slice(0, 5).join('\n• ');
      Alert.alert('Available Phrases (first 5)', `• ${phrases}\n\n...and more`);
    }
  };

  const openLanguageModal = (type: 'source' | 'target') => {
    setSelectedLanguageType(type);
    setShowLanguageModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Translate</Text>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              'Translation Mode',
              useAITranslation ? 'AI Translation (Offline)' : 'Phrasebook Mode',
              [
                {
                  text: 'Switch Mode',
                  onPress: () => setUseAITranslation(!useAITranslation),
                },
                { text: 'Cancel' },
              ]
            );
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Model Status Banner */}
      {useAITranslation && (
        <View style={[styles.statusBanner, modelLoaded ? styles.statusSuccess : styles.statusWarning]}>
          <Ionicons 
            name={modelLoaded ? "checkmark-circle" : "warning"} 
            size={16} 
            color={modelLoaded ? "#10b981" : "#f59e0b"} 
          />
          <Text style={styles.statusText}>
            {modelLoaded ? 'AI Translation Ready (Offline)' : 'Loading AI Model...'}
          </Text>
        </View>
      )}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.translationContainer}>
          {/* Source Language */}
          <View style={styles.languageSection}>
            <TouchableOpacity 
              style={styles.languageSelector}
              onPress={() => openLanguageModal('source')}
            >
              <Text style={styles.languageFlag}>{sourceLanguage.flag}</Text>
              <Text style={styles.languageText}>{sourceLanguage.name}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
            
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter text to translate"
                placeholderTextColor="#999"
                value={sourceText}
                onChangeText={setSourceText}
                multiline
                textAlignVertical="top"
                editable={!isTranslating}
              />
              {sourceText.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={() => {
                    setSourceText('');
                    setTargetText('');
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Language Swap Button */}
          <View style={styles.swapContainer}>
            <TouchableOpacity 
              style={styles.swapButton} 
              onPress={swapLanguages}
              disabled={isTranslating}
            >
              <Ionicons name="swap-vertical" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Target Language */}
          <View style={styles.languageSection}>
            <TouchableOpacity 
              style={styles.languageSelector}
              onPress={() => openLanguageModal('target')}
            >
              <Text style={styles.languageFlag}>{targetLanguage.flag}</Text>
              <Text style={[styles.languageText, styles.targetLanguageText]}>
                {targetLanguage.name}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
            
            <View style={[styles.textInputContainer, styles.translatedTextContainer]}>
              <ScrollView style={styles.translatedScrollView}>
                {isTranslating ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.loadingText}>Translating...</Text>
                  </View>
                ) : (
                  <Text style={styles.translatedText}>
                    {targetText || 'Translation will appear here'}
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>

          {/* Translate Button */}
          <TouchableOpacity 
            style={[styles.translateButton, isTranslating && styles.translateButtonDisabled]} 
            onPress={handleTranslate}
            disabled={isTranslating}
          >
            <Text style={styles.translateButtonText}>
              {isTranslating ? 'Translating...' : 'Translate'}
            </Text>
          </TouchableOpacity>

          {/* Translation Info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              {useAITranslation 
                ? 'Using offline AI translation' 
                : 'Using offline phrasebook'}
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
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
                        (selectedLanguageType === 'source' ? sourceLanguage : targetLanguage).code === language.code && 
                        styles.selectedLanguageItem
                      ]}
                      onPress={() => handleLanguageSelect(language)}
                    >
                      <View style={styles.languageItemContent}>
                        <Text style={styles.languageFlag}>{language.flag}</Text>
                        <Text style={styles.languageName}>{language.name}</Text>
                      </View>
                      {(selectedLanguageType === 'source' ? sourceLanguage : targetLanguage).code === language.code && (
                        <View style={styles.checkmarkContainer}>
                          <Ionicons name="checkmark" size={20} color="#000" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  statusSuccess: {
    backgroundColor: '#f0fdf4',
  },
  statusWarning: {
    backgroundColor: '#fffbeb',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  translationContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  languageSection: {
    marginBottom: 20,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  languageFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    flex: 1,
  },
  targetLanguageText: {
    color: '#000',
  },
  textInputContainer: {
    position: 'relative',
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    paddingRight: 50,
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
  },
  translatedTextContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    minHeight: 120,
    padding: 16,
  },
  translatedScrollView: {
    flex: 1,
  },
  translatedText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  swapButton: {
    backgroundColor: '#000',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  translateButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  translateButtonDisabled: {
    opacity: 0.6,
  },
  translateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
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
