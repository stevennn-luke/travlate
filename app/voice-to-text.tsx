import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Use local safe wrapper to avoid crashes in Expo Go
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  VoiceNote,
  deleteVoiceNote,
  getVoiceNotes,
  initDatabase,
  saveVoiceNote
} from './services/DatabaseService';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from './utils/SafeSpeechRecognition';

export default function VoiceToTextScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [permission, setPermission] = useState(false);

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VoiceNote[]>([]);

  // Speech Recognition Hook
  useSpeechRecognitionEvent('start', () => setIsRecording(true));
  useSpeechRecognitionEvent('end', () => setIsRecording(false));
  useSpeechRecognitionEvent('result', (event) => {
    // Determine the best result
    const result = event.results[0]?.transcript;
    if (result) {
      setTranscribedText(result);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.log('recognition error:', event);
    setIsRecording(false);
    // If it's a network error, we can inform the user about offline mode capabilities (if configured)
    Alert.alert('Error', event.message || 'Speech recognition failed.');
  });

  useEffect(() => {
    initDatabase();
    loadHistory();
    checkPermissions();
  }, []);

  const loadHistory = () => {
    const notes = getVoiceNotes();
    setHistory(notes);
  };

  const checkPermissions = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermission(result.granted);
    } catch (e) {
      console.log("Permission check failed (likely Expo Go)", e);
      setPermission(false);
    }
  };

  // ----- Simulation Logic for Expo Go -----
  const [simulationTimer, setSimulationTimer] = useState<NodeJS.Timeout | null>(null);

  const simulateRecording = () => {
    setIsRecording(true);
    setTranscribedText('');
    let dots = '';
    const interval = setInterval(() => {
      dots = dots.length < 3 ? dots + '.' : '';
      setTranscribedText(`Listening (Expo Go Simulation)${dots}`);
    }, 500);
    setSimulationTimer(interval as unknown as NodeJS.Timeout);
  };
  // ----------------------------------------

  const startRecording = async () => {
    // In Expo Go, the module might throw or not be found/initialized properly for native calls as per the user's setup.
    // We try/catch the native call to start.
    try {
      if (!permission) {
        try {
          const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!result.granted) {
            Alert.alert('Permission needed', 'Please grant microphone permission to use this feature.');
            return;
          }
          setPermission(true);
        } catch (e) {
          // Fallback to simulation if permission request fails (e.g. module missing mock)
          simulateRecording();
          return;
        }
      }

      // Check if offline recognition is supported/available
      // Currently only on Android
      const supportsOnDevice = await ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();

      const options: any = {
        lang: 'en-US',
        interimResults: true,
      };

      if (supportsOnDevice && Platform.OS === 'android') {
        options.requiresOnDeviceRecognition = true;
      }

      ExpoSpeechRecognitionModule.start(options);
    } catch (e: any) {
      console.log('Start error:', e);
      // Fallback for Expo Go (Simulator) since native module interaction might fail or be limited
      simulateRecording();
    }
  };


  const stopRecording = () => {
    // If we were simulating, stop the simulation
    if (simulationTimer) {
      clearInterval(simulationTimer);
      setSimulationTimer(null);
      setIsRecording(false);
      setTranscribedText(prev => {
        // Replace listening text with mock result
        if (prev && prev.includes('Listening')) {
          return "This is a simulated transcription for Expo Go. Native speech recognition requires a Development Build.";
        }
        return prev;
      });
      return;
    }

    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.log("Stop error:", e);
    }
  };


  const handleSaveNote = () => {
    if (transcribedText && !transcribedText.includes('Listening (Expo Go Simulation)')) {
      saveVoiceNote(transcribedText);
      Alert.alert('Saved', 'Voice note saved to history.');
      loadHistory();
      setTranscribedText('');
    } else if (transcribedText.includes('Listening (Expo Go Simulation)')) {
      // Allow saving simulation text for demo purposes
      saveVoiceNote("Simulated Voice Note: " + new Date().toLocaleTimeString());
      Alert.alert('Saved', 'Simulated note saved.');
      loadHistory();
      setTranscribedText('');
    }
  };

  const handleDeleteNote = (id: number) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteVoiceNote(id);
          loadHistory();
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Voice to Text</Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowHistory(true)}
        >
          <Ionicons name="time-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={[styles.statusBanner, styles.statusInfo]}>
        <Ionicons name="mic-outline" size={16} color="#007AFF" />
        <Text style={styles.statusText}>
          {Platform.OS === 'android' ? 'Offline Speech Supported' : 'Native Online Speech (Offline limited)'}
        </Text>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.transcriptionContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {transcribedText ? (
              <Text style={styles.transcriptionText}>{transcribedText}</Text>
            ) : (
              <Text style={styles.placeholderText}>
                Tap the microphone button and start speaking...
              </Text>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {transcribedText ? (
            <View style={styles.resultActions}>
              <TouchableOpacity onPress={handleSaveNote} style={styles.saveButton}>
                <Ionicons name="save-outline" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Note</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTranscribedText('')} style={styles.clearButton}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording ? styles.recordingActive : styles.recordingInactive,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <View style={styles.recordIconContainer}>
              {isRecording ? (
                <Ionicons name="stop" size={32} color="white" />
              ) : (
                <Ionicons name="mic" size={32} color="white" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.recordStatusText}>
            {isRecording ? 'Listening...' : 'Tap to Record'}
          </Text>
        </View>
      </View>

      {/* History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <SafeAreaView style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Voice History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={history}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.historyList}
            ListEmptyComponent={<Text style={styles.emptyHistory}>No voice notes saved.</Text>}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <View style={styles.historyMeta}>
                  <Ionicons name="mic" size={16} color="#007AFF" style={{ marginRight: 6 }} />
                  <Text style={styles.historyDate}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>
                <Text style={styles.historyText}>{item.transcription}</Text>
                <TouchableOpacity
                  style={styles.deleteHistoryButton}
                  onPress={() => handleDeleteNote(item.id)}
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
  statusInfo: {
    backgroundColor: '#eff6ff',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  transcriptionContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    position: 'relative',
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  transcriptionText: {
    fontSize: 18,
    color: '#333',
    lineHeight: 28,
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginTop: 100,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingActive: {
    backgroundColor: '#FF3B30',
  },
  recordingInactive: {
    backgroundColor: '#000',
  },
  recordIconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordStatusText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  resultActions: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: '#e5e5e5',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  historyText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 4,
  },
  deleteHistoryButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    padding: 4,
  },
});
