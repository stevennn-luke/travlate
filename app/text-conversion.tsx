import { Ionicons } from '@expo/vector-icons';
import TranslateText, { TranslateLanguage } from '@react-native-ml-kit/translate-text';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Translation,
  deleteTranslation,
  getTranslations,
  initDatabase,
  saveTranslation
} from './services/DatabaseService';

// Language data with Flags
const languages = [
  { code: 'en', mlCode: TranslateLanguage.ENGLISH, name: 'English (US)', flag: 'https://flagcdn.com/w80/us.png' },
  { code: 'es', mlCode: TranslateLanguage.SPANISH, name: 'Spanish (Spain)', flag: 'https://flagcdn.com/w80/es.png' },
  { code: 'fr', mlCode: TranslateLanguage.FRENCH, name: 'French (France)', flag: 'https://flagcdn.com/w80/fr.png' },
  { code: 'de', mlCode: TranslateLanguage.GERMAN, name: 'German (Germany)', flag: 'https://flagcdn.com/w80/de.png' },
  { code: 'it', mlCode: TranslateLanguage.ITALIAN, name: 'Italian (Italy)', flag: 'https://flagcdn.com/w80/it.png' },
  { code: 'pt', mlCode: TranslateLanguage.PORTUGUESE, name: 'Portuguese (Portugal)', flag: 'https://flagcdn.com/w80/pt.png' },
  { code: 'nl', mlCode: TranslateLanguage.DUTCH, name: 'Dutch (Netherlands)', flag: 'https://flagcdn.com/w80/nl.png' },
  { code: 'ru', mlCode: TranslateLanguage.RUSSIAN, name: 'Russian (Russia)', flag: 'https://flagcdn.com/w80/ru.png' },
  { code: 'ja', mlCode: TranslateLanguage.JAPANESE, name: 'Japanese', flag: 'https://flagcdn.com/w80/jp.png' },
  { code: 'ko', mlCode: TranslateLanguage.KOREAN, name: 'Korean', flag: 'https://flagcdn.com/w80/kr.png' },
  { code: 'hi', mlCode: TranslateLanguage.HINDI, name: 'Hindi', flag: 'https://flagcdn.com/w80/in.png' },
];

export default function TextConversionScreen() {
  const router = useRouter();
  const [sourceLanguage, setSourceLanguage] = useState(languages[0]);
  const [targetLanguage, setTargetLanguage] = useState(languages[1]);
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // Dropdown States
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Translation[]>([]);

  useEffect(() => {
    initDatabase();
    loadHistory();
  }, []);

  const loadHistory = () => {
    const data = getTranslations();
    setHistory(data);
  };

  const handleSaveTranslation = () => {
    if (sourceText && targetText) {
      saveTranslation(sourceText, targetText, sourceLanguage.name, targetLanguage.name);
      Alert.alert('Saved', 'Translation saved to history.');
      loadHistory();
    }
  };

  const handleDeleteTranslation = (id: number) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteTranslation(id);
          loadHistory();
        }
      }
    ]);
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);

    const tempText = sourceText;
    setSourceText(targetText);
    setTargetText(tempText);
  };

  // Translation with ML Kit and API Fallback
  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      Alert.alert('Error', 'Please enter text to translate');
      return;
    }

    setIsTranslating(true);
    setTargetText('');

    try {
      // 1. Try Native offline ML Kit (Transformer Based)
      const translated = await TranslateText.translate({
        text: sourceText,
        sourceLanguage: sourceLanguage.mlCode,
        targetLanguage: targetLanguage.mlCode,
        downloadModelIfNeeded: true,
      }) as unknown as string;

      setTargetText(translated);

    } catch (error: any) {
      console.log('Native ML Kit unavailable, using online translation API');

      // 2. Fallback to MyMemory Translation API (free, no API key needed)
      try {
        const sourceLang = sourceLanguage.code;
        const targetLang = targetLanguage.code;
        const encodedText = encodeURIComponent(sourceText);

        const response = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${sourceLang}|${targetLang}`
        );

        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData.translatedText) {
          setTargetText(data.responseData.translatedText);
        } else {
          throw new Error('Translation API failed');
        }
      } catch (apiError) {
        console.error('Translation API error:', apiError);
        Alert.alert(
          'Translation Unavailable',
          'Translation service is currently unavailable. Please try again later or use a native build for offline translation.'
        );
        setTargetText('');
      }
    } finally {
      setIsTranslating(false);
    }
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
          onPress={() => setShowHistory(true)}
        >
          <Ionicons name="time-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={[styles.statusBanner, styles.statusInfo]}>
        <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
        <Text style={styles.statusText}>
          Offline translation requires native build (currently using online API)
        </Text>
      </View>

      <TouchableWithoutFeedback onPress={() => {
        Keyboard.dismiss();
        setShowSourceDropdown(false);
        setShowTargetDropdown(false);
      }} accessible={false}>
        <View style={styles.translationContainer}>

          {/* Source Section */}
          <View style={styles.languageSection}>
            <View style={{ zIndex: 2000 }}>
              <TouchableOpacity
                style={styles.languageSelector}
                onPress={() => {
                  setShowTargetDropdown(false);
                  setShowSourceDropdown(!showSourceDropdown);
                }}
              >
                <ExpoImage
                  source={{ uri: sourceLanguage.flag }}
                  style={styles.circularFlag}
                />
                <Text style={styles.languageText}>{sourceLanguage.name}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              {showSourceDropdown && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                    {languages.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSourceLanguage(lang);
                          setShowSourceDropdown(false);
                        }}
                      >
                        <ExpoImage
                          source={{ uri: lang.flag }}
                          style={[styles.circularFlag, { marginRight: 12 }]}
                        />
                        <Text style={styles.dropdownLabel}>{lang.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter text..."
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

          {/* Swap Button */}
          <View style={styles.swapContainer}>
            <TouchableOpacity
              style={styles.swapButton}
              onPress={swapLanguages}
              disabled={isTranslating}
            >
              <Ionicons name="swap-vertical" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Target Section */}
          <View style={styles.languageSection}>
            <View style={{ zIndex: 1000 }}>
              <TouchableOpacity
                style={styles.languageSelector}
                onPress={() => {
                  setShowSourceDropdown(false);
                  setShowTargetDropdown(!showTargetDropdown);
                }}
              >
                <ExpoImage
                  source={{ uri: targetLanguage.flag }}
                  style={styles.circularFlag}
                />
                <Text style={styles.languageText}>{targetLanguage.name}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              {showTargetDropdown && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                    {languages.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setTargetLanguage(lang);
                          setShowTargetDropdown(false);
                        }}
                      >
                        <ExpoImage
                          source={{ uri: lang.flag }}
                          style={[styles.circularFlag, { marginRight: 12 }]}
                        />
                        <Text style={styles.dropdownLabel}>{lang.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={[styles.textInputContainer, styles.translatedTextContainer]}>
              <ScrollView style={styles.translatedScrollView}>
                {isTranslating ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#000" />
                    <Text style={styles.loadingText}>Running Transformer...</Text>
                  </View>
                ) : (
                  <Text style={styles.translatedText}>
                    {targetText || 'Translation will appear here'}
                  </Text>
                )}
              </ScrollView>
              {targetText ? (
                <View style={styles.resultActions}>
                  <TouchableOpacity onPress={handleSaveTranslation} style={styles.iconAction}>
                    <Ionicons name="bookmark-outline" size={20} color="#666" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { }} style={styles.iconAction}>
                    <Ionicons name="copy-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              ) : null}
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
        </View>
      </TouchableWithoutFeedback>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Translation History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.historyList}
            ListEmptyComponent={<Text style={styles.emptyHistory}>No translations saved.</Text>}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <View style={styles.historyLanguages}>
                  <Text style={styles.historyLangTag}>{item.sourceLang} → {item.targetLang}</Text>
                  <Text style={styles.historyDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.historySource} numberOfLines={1}>{item.sourceText}</Text>
                <Text style={styles.historyTarget} numberOfLines={2}>{item.targetText}</Text>

                <TouchableOpacity
                  style={styles.deleteHistoryButton}
                  onPress={() => handleDeleteTranslation(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
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
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    zIndex: 10,
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
    zIndex: 10,
  },
  statusInfo: {
    backgroundColor: '#eff6ff',
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
    zIndex: 1,
  },
  languageSection: {
    marginBottom: 20,
    position: 'relative',
    zIndex: 10,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  circularFlag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    marginRight: 8,
    flex: 1,
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50, // Below the selector
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 250,
    zIndex: 9999, // Ensure it's on top
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownLabel: {
    fontSize: 16,
    color: '#333',
  },
  textInputContainer: {
    position: 'relative',
    marginTop: 8,
    zIndex: 1,
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
    marginBottom: 20,
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
    zIndex: 1,
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
    zIndex: 1,
  },
  translateButtonDisabled: {
    opacity: 0.6,
  },
  translateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  iconAction: {
    padding: 6,
    backgroundColor: '#e5e5e5',
    borderRadius: 20,
  },
  // History Styles
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
    fontWeight: '700',
  },
  historyList: {
    padding: 16,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  historyItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    position: 'relative',
  },
  historyLanguages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyLangTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
  },
  historySource: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  historyTarget: {
    fontSize: 14,
    color: '#666',
  },
  deleteHistoryButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 4,
  },
});
