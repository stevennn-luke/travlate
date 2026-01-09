import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import {
    PhoneAuthProvider,
    linkWithCredential,
    updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase.config';
import { getLocalUserProfile, initDatabase, saveLocalUserProfile } from './services/DatabaseService';
import { ExpoSpeechRecognitionModule } from './utils/SafeSpeechRecognition';
import { TranslateLanguage } from './utils/SafeTranslator';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, logout, linkEmail, linkPhone } = useAuth();
    const recaptchaVerifier = useRef(null);

    const [name, setName] = useState(user?.displayName || '');
    const [isEditing, setIsEditing] = useState(false);
    const [emailInput, setEmailInput] = useState(user?.email || '');
    const [phoneInput, setPhoneInput] = useState(user?.phoneNumber || '');

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);

    // New States for Content & Data
    const [showDownloadsModal, setShowDownloadsModal] = useState(false);
    const [showOcrModal, setShowOcrModal] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [downloadedOcrModels, setDownloadedOcrModels] = useState<string[]>(['Latin']); // Latin is usually default

    const [cameraPerm, requestCameraPerm] = useCameraPermissions();
    const [locationPerm, setLocationPerm] = useState<boolean>(false);
    const [micPerm, setMicPerm] = useState<boolean>(false);

    const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
    const [availableLanguages] = useState([
        { code: TranslateLanguage.ENGLISH, name: 'English' },
        { code: TranslateLanguage.SPANISH, name: 'Spanish' },
        { code: TranslateLanguage.FRENCH, name: 'French' },
        { code: TranslateLanguage.GERMAN, name: 'German' },
        { code: TranslateLanguage.ITALIAN, name: 'Italian' },
        { code: TranslateLanguage.JAPANESE, name: 'Japanese' },
        { code: TranslateLanguage.KOREAN, name: 'Korean' },
        { code: TranslateLanguage.HINDI, name: 'Hindi' },
    ]);

    useEffect(() => {
        initDatabase();
        loadUserProfile();
        checkPermissions();
        setDownloadedModels(['English', 'Spanish']);

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkPermissions();
                // requestCameraPerm hook usually updates itself, but we can re-request status if needed
                // or just rely on the hook's internal update if configured. 
                // However, for consistency we might want to manually check if the hook doesn't auto-update on resume.
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const checkPermissions = async () => {
        const locStatus = await Location.getForegroundPermissionsAsync();
        setLocationPerm(locStatus.granted);

        const micStatus = await ExpoSpeechRecognitionModule.getPermissionsAsync();
        setMicPerm(micStatus.granted);
    };

    const togglePermission = async (type: 'camera' | 'location' | 'mic') => {
        if (type === 'camera') {
            if (!cameraPerm?.granted) {
                const result = await requestCameraPerm();
                if (!result.granted) openSettingsAlert('Camera');
            } else {
                openSettingsAlert('Camera');
            }
        } else if (type === 'location') {
            if (!locationPerm) {
                const result = await Location.requestForegroundPermissionsAsync();
                setLocationPerm(result.granted);
                if (!result.granted) openSettingsAlert('Location');
            } else {
                openSettingsAlert('Location');
            }
        } else if (type === 'mic') {
            if (!micPerm) {
                const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
                setMicPerm(result.granted);
                if (!result.granted) openSettingsAlert('Microphone');
            } else {
                openSettingsAlert('Microphone');
            }
        }
    };

    const openSettingsAlert = (permName: string) => {
        Alert.alert(
            `${permName} Access`,
            `To change ${permName} permissions, please go to your device settings.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
        );
    };

    const loadUserProfile = async () => {
        if (!user?.uid) return;

        const localProfile = getLocalUserProfile(user.uid);
        if (localProfile) {
            if (localProfile.name) setName(localProfile.name);
            setNotificationsEnabled(localProfile.notificationsEnabled === 1);
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.name) setName(data.name);
                if (data.notificationsEnabled !== undefined) setNotificationsEnabled(data.notificationsEnabled);

                saveLocalUserProfile({
                    id: user.uid,
                    name: data.name || name,
                    email: user.email || null,
                    phoneNumber: user.phoneNumber || null,
                    selectedVoice: null,
                    notificationsEnabled: data.notificationsEnabled ? 1 : 0,
                    voiceAssistantEnabled: 0,
                    appLockEnabled: 0,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (error: any) {
            console.log('Error loading user profile:', error);
        }
    };

    const handleSave = async () => {
        if (!user?.uid) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setIsEditing(false);

        try {
            saveLocalUserProfile({
                id: user.uid,
                name: name,
                email: emailInput || null,
                phoneNumber: phoneInput || null,
                selectedVoice: null,
                notificationsEnabled: notificationsEnabled ? 1 : 0,
                voiceAssistantEnabled: 0,
                appLockEnabled: 0,
                updatedAt: new Date().toISOString()
            });

            const userDocRef = doc(db, 'users', user.uid);
            const userData = {
                name: name,
                email: user.email || null,
                phoneNumber: user.phoneNumber || null,
                notificationsEnabled: notificationsEnabled,
                updatedAt: new Date(),
            };

            await setDoc(userDocRef, userData, { merge: true });

            if (name !== user.displayName && user) {
                await updateProfile(user, { displayName: name });
            }

            Alert.alert('Success', 'Profile updated successfully!');
        } catch (error: any) {
            console.error('Error saving profile:', error);
            Alert.alert('Saved Locally', 'Profile saved offline. Will sync when online.');
        }
    };

    const handleLinkEmail = async () => {
        if (!newEmail || !newPassword) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }
        setIsLoading(true);
        try {
            await linkEmail(newEmail, newPassword);
            setShowEmailModal(false);
            Alert.alert('Success', 'Email linked successfully!');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinkPhone = async () => {
        if (!newPhone) {
            Alert.alert('Error', 'Please enter phone number');
            return;
        }
        setIsLoading(true);
        try {
            const confirmation = await linkPhone(newPhone, recaptchaVerifier.current as any);
            setVerificationId(confirmation.verificationId);
            setShowPhoneModal(false);
            setShowCodeModal(true);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode || !verificationId) return;
        setIsLoading(true);
        try {
            const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
            if (auth.currentUser) {
                await linkWithCredential(auth.currentUser, credential);
                setShowCodeModal(false);
                Alert.alert('Success', 'Phone number linked successfully!');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                            router.replace('/');
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to logout.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            <View style={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10 }}>
                <TouchableOpacity
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                        marginBottom: 20
                    }}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#000' }}>Profile</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

                <View style={styles.section}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={[styles.input, !isEditing && styles.inputDisabled]}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            placeholderTextColor="#999"
                            editable={isEditing}
                        />
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={[styles.input, !isEditing && styles.inputDisabled]}
                            value={isEditing ? emailInput : (user?.email || emailInput)}
                            onChangeText={setEmailInput}
                            placeholder="No email linked"
                            placeholderTextColor="#999"
                            editable={isEditing}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        {isEditing && !user?.email && (
                            <TouchableOpacity onPress={() => setShowEmailModal(true)}>
                                <Text style={{ color: '#007AFF', marginTop: 8, fontSize: 14 }}>Link Email Account</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, !isEditing && styles.inputDisabled]}
                            value={isEditing ? phoneInput : (user?.phoneNumber || phoneInput)}
                            onChangeText={setPhoneInput}
                            placeholder="No phone number linked"
                            placeholderTextColor="#999"
                            editable={isEditing}
                        />
                        {isEditing && !user?.phoneNumber && (
                            <TouchableOpacity onPress={() => setShowPhoneModal(true)}>
                                <Text style={{ color: '#007AFF', marginTop: 8, fontSize: 14 }}>Link Phone Number</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.editActionsContainer}>
                        {isEditing ? (
                            <>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                    <Text style={styles.saveButtonText}>Save</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                                <Text style={styles.editButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Permissions</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="mic-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Microphone</Text>
                        </View>
                        <Switch
                            value={micPerm}
                            onValueChange={() => togglePermission('mic')}
                            trackColor={{ false: "#e0e0e0", true: "#61D8D8" }}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="camera-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Camera</Text>
                        </View>
                        <Switch
                            value={cameraPerm?.granted || false}
                            onValueChange={() => togglePermission('camera')}
                            trackColor={{ false: "#e0e0e0", true: "#61D8D8" }}
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="location-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Location</Text>
                        </View>
                        <Switch
                            value={locationPerm}
                            onValueChange={() => togglePermission('location')}
                            trackColor={{ false: "#e0e0e0", true: "#61D8D8" }}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Content & Data</Text>
                    <TouchableOpacity
                        style={[
                            styles.settingItem,
                            {
                                backgroundColor: '#f5f5f5',
                                borderRadius: 8,
                                paddingHorizontal: 16,
                                borderBottomWidth: 0,
                                marginBottom: 10
                            }
                        ]}
                        onPress={() => setShowDownloadsModal(true)}
                    >
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="cloud-download-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Offline Translation</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.settingItem,
                            {
                                backgroundColor: '#f5f5f5',
                                borderRadius: 8,
                                paddingHorizontal: 16,
                                borderBottomWidth: 0,
                                marginBottom: 0
                            }
                        ]}
                        onPress={() => setShowOcrModal(true)}
                    >
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="scan-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Offline OCR Models</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>

            <Modal visible={showEmailModal} animationType="slide" transparent={true}>
                <View style={styles.centeredModalOverlay}>
                    <View style={styles.centeredModalContent}>
                        <Text style={styles.modalTitle}>Link Email</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Email"
                            value={newEmail}
                            onChangeText={setNewEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowEmailModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleLinkEmail} disabled={isLoading}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Link</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showPhoneModal} animationType="slide" transparent={true}>
                <View style={styles.centeredModalOverlay}>
                    <View style={styles.centeredModalContent}>
                        <Text style={styles.modalTitle}>Link Phone Number</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="+1 555 555 5555"
                            value={newPhone}
                            onChangeText={setNewPhone}
                            keyboardType="phone-pad"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowPhoneModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleLinkPhone} disabled={isLoading}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Send Code</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showCodeModal} animationType="slide" transparent={true}>
                <View style={styles.centeredModalOverlay}>
                    <View style={styles.centeredModalContent}>
                        <Text style={styles.modalTitle}>Enter Verification Code</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="123456"
                            value={verificationCode}
                            onChangeText={setVerificationCode}
                            keyboardType="number-pad"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowCodeModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleVerifyCode} disabled={isLoading}>
                                {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Verify</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showDownloadsModal} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
                    <View style={{ padding: 24, paddingTop: 50, paddingBottom: 10 }}>
                        <TouchableOpacity
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: '#fff',
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 3,
                                marginBottom: 20
                            }}
                            onPress={() => setShowDownloadsModal(false)}
                        >
                            <Ionicons name="chevron-back" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 32, fontWeight: '700', color: '#000', marginTop: 10 }}>Offline Languages</Text>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                            {availableLanguages.map((lang, index) => {
                                const isDownloaded = downloadedModels.includes(lang.name);
                                return (
                                    <View key={index} style={[
                                        styles.settingItem,
                                        {
                                            paddingHorizontal: 16,
                                            borderBottomWidth: index === availableLanguages.length - 1 ? 0 : 1
                                        }
                                    ]}>
                                        <Text style={styles.settingItemText}>{lang.name}</Text>
                                        {isDownloaded ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons name="checkmark-circle" size={20} color="#61D8D8" />
                                                <Text style={{ color: '#333', fontSize: 14 }}>Downloaded</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity onPress={() => {
                                                Alert.alert('Download', `Download ${lang.name} language model?`, [
                                                    { text: 'Cancel' },
                                                    {
                                                        text: 'Download', onPress: () => {
                                                            setIsLoading(true);
                                                            setTimeout(() => {
                                                                setDownloadedModels((prev: string[]) => [...prev, lang.name]);
                                                                setIsLoading(false);
                                                            }, 1500);
                                                        }
                                                    }
                                                ]);
                                            }}>
                                                <Ionicons name="download-outline" size={24} color="#007AFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                        <Text style={{ marginTop: 12, color: '#666', fontSize: 13, paddingHorizontal: 12 }}>
                            Downloaded languages allow you to translate text and speech even when you have no internet connection.
                        </Text>
                    </ScrollView>
                </View>
            </Modal>

            <Modal visible={showOcrModal} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
                    <View style={{ padding: 24, paddingTop: 50, paddingBottom: 10 }}>
                        <TouchableOpacity
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: '#fff',
                                justifyContent: 'center',
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 3,
                                marginBottom: 20
                            }}
                            onPress={() => setShowOcrModal(false)}
                        >
                            <Ionicons name="chevron-back" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 32, fontWeight: '700', color: '#000', marginTop: 10 }}>Offline OCR Models</Text>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                            {[
                                { name: 'Latin', desc: 'English, Spanish, French, Italian, German, etc.' },
                                { name: 'Chinese', desc: 'Chinese (Simplified & Traditional)' },
                                { name: 'Japanese', desc: 'Japanese' },
                                { name: 'Korean', desc: 'Korean' },
                                { name: 'Devanagari', desc: 'Hindi, Marathi, Nepali, etc.' },
                            ].map((script, index, arr) => {
                                const isDownloaded = downloadedOcrModels.includes(script.name);
                                return (
                                    <View key={index} style={[
                                        styles.settingItem,
                                        {
                                            paddingHorizontal: 16,
                                            borderBottomWidth: index === arr.length - 1 ? 0 : 1
                                        }
                                    ]}>
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <Text style={styles.settingItemText}>{script.name}</Text>
                                            <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{script.desc}</Text>
                                        </View>

                                        {isDownloaded ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Ionicons name="checkmark-circle" size={20} color="#61D8D8" />
                                                <Text style={{ color: '#333', fontSize: 14 }}>Ready</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity onPress={() => {
                                                Alert.alert('Download', `Download ${script.name} OCR model?`, [
                                                    { text: 'Cancel' },
                                                    {
                                                        text: 'Download', onPress: () => {
                                                            setIsLoading(true);
                                                            // Mock download delay
                                                            setTimeout(() => {
                                                                setDownloadedOcrModels(prev => [...prev, script.name]);
                                                                setIsLoading(false);
                                                            }, 2000);
                                                        }
                                                    }
                                                ]);
                                            }}>
                                                <Ionicons name="download-outline" size={24} color="#007AFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                        <Text style={{ marginTop: 12, color: '#666', fontSize: 13, paddingHorizontal: 12 }}>
                            These models allow the camera to recognize text in specific scripts without an internet connection.
                        </Text>
                    </ScrollView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDF1F3',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 10,
    },
    editActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    editButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#000',
        borderRadius: 20,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#000',
        borderRadius: 20,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
        marginBottom: 16,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#000',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    inputDisabled: {
        backgroundColor: '#fafafa',
        color: '#666',
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12, // Reduced from 16
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Reduced gap generally, but permissions needs specific tightening? No, standard 12 is fine, maybe paddingVertical caused the "gap" in rows
    },
    settingItemText: {
        fontSize: 16,
        color: '#000',
    },

    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#ff3b30',
        marginTop: 20,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff3b30',
    },
    versionText: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginTop: 24,
    },
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    centeredModalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
    },
    modalCancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    modalCancelText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    modalConfirmButton: {
        backgroundColor: '#000',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 20,
        minWidth: 80,
        alignItems: 'center',
    },
    modalConfirmText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
