import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
// linkWithCredential is used inside AuthContext but we import types/functions for local logic if needed
import {
    PhoneAuthProvider,
    linkWithCredential,
    updateProfile // We import this dynamically usually but static import is fine too
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase.config';
import { clearLocalDatabase, getLocalUserProfile, initDatabase, saveLocalUserProfile } from './services/DatabaseService';

export default function ProfileScreen() {
    const router = useRouter();
    // Removed authenticate as it's not used (since app lock removed)
    const { user, logout, linkEmail, linkPhone } = useAuth();
    const recaptchaVerifier = useRef(null);

    const [name, setName] = useState(user?.displayName || '');
    const [isEditing, setIsEditing] = useState(false);
    const [emailInput, setEmailInput] = useState(user?.email || '');
    const [phoneInput, setPhoneInput] = useState(user?.phoneNumber || '');

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // Linking State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        initDatabase();
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        if (!user?.uid) return;

        // 1. Load from Local SQLite
        const localProfile = getLocalUserProfile(user.uid);
        if (localProfile) {
            if (localProfile.name) setName(localProfile.name);
            setNotificationsEnabled(localProfile.notificationsEnabled === 1);
        }

        // 2. Cloud sync
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.name) setName(data.name);
                if (data.notificationsEnabled !== undefined) setNotificationsEnabled(data.notificationsEnabled);

                // Update local DB
                saveLocalUserProfile({
                    id: user.uid,
                    name: data.name || name,
                    email: user.email || null,
                    phoneNumber: user.phoneNumber || null,
                    selectedVoice: null,
                    notificationsEnabled: data.notificationsEnabled ? 1 : 0,
                    voiceAssistantEnabled: 0, // Disabled feature
                    appLockEnabled: 0, // Disabled feature
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Error loading user profile from cloud:', error);
        }
    };

    const handleSave = async () => {
        if (!user?.uid) {
            Alert.alert('Error', 'User not authenticated');
            return;
        }

        setIsEditing(false);

        try {
            // 1. Save Local (SQLite)
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

            // 2. Save to Firestore (Cloud)
            const userDocRef = doc(db, 'users', user.uid);
            const userData = {
                name: name,
                email: user.email || null,
                phoneNumber: user.phoneNumber || null,
                notificationsEnabled: notificationsEnabled,
                updatedAt: new Date(),
            };

            await setDoc(userDocRef, userData, { merge: true });

            // Update Auth Profile
            if (name !== user.displayName && user) {
                // We use dynamic import to avoid issues or standard import
                // const { updateProfile } = await import('firebase/auth');
                // Actually simple import is fine since we are in RN
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
            // @ts-ignore
            const confirmation = await linkPhone(newPhone, recaptchaVerifier.current);
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
            // Verify code logic uses PhoneAuthProvider credential
            // But we can also use confirmationResult.confirm() if we had the object. 
            // Since we stored ID, we use credential.
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
                            console.error('Logout error:', error.message);
                            Alert.alert('Error', 'Failed to logout. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const handleClearAllData = async () => {
        Alert.alert(
            '⚠️ Clear All Data',
            'This will permanently delete ALL items, logs, and user data from both local and cloud storage. This action cannot be undone!',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear Everything',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // Clear Firestore collections
                            const collections = ['items', 'logs', 'users'];
                            let totalDeleted = 0;

                            for (const collectionName of collections) {
                                const querySnapshot = await getDocs(collection(db, collectionName));
                                for (const docSnap of querySnapshot.docs) {
                                    await deleteDoc(doc(db, collectionName, docSnap.id));
                                    totalDeleted++;
                                }
                            }

                            // Clear local database
                            clearLocalDatabase();

                            Alert.alert(
                                'Success',
                                `All data cleared! Deleted ${totalDeleted} cloud documents and cleared local database.`,
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => {
                                            logout();
                                            router.replace('/');
                                        }
                                    }
                                ]
                            );
                        } catch (error: any) {
                            console.error('Error clearing data:', error);
                            Alert.alert('Error', 'Failed to clear all data: ' + error.message);
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Home Back Button */}
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        zIndex: 10,
                        padding: 8,
                    }}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>

                {/* Profile Header */}
                <View style={[styles.section, { marginBottom: 24 }]}>
                    <Text style={{ fontSize: 32, fontWeight: '700', color: '#000' }}>Profile</Text>
                </View>

                {/* Personal Details Form */}
                <View style={styles.section}>
                    {/* Name */}
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

                    {/* Email */}
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

                    {/* Phone */}
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

                    {/* Edit Actions */}
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

                {/* Account Settings */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Settings</Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="notifications-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Notifications</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: "#e0e0e0", true: "#000" }}
                        />
                    </View>

                    <TouchableOpacity style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <Ionicons name="help-circle-outline" size={24} color="#000" />
                            <Text style={styles.settingItemText}>Help & Support</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>
                </View>

                {/* Clear All Data Button */}
                <TouchableOpacity
                    style={styles.clearDataButton}
                    onPress={handleClearAllData}
                    disabled={isLoading}
                >
                    <Ionicons name="trash-outline" size={24} color="#ff9500" />
                    <Text style={styles.clearDataButtonText}>Clear All Data</Text>
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color="#ff3b30" />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>

                {/* App Version */}
                <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>

            {/* Email Link Modal */}
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

            {/* Phone Link Modal */}
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

            {/* Verification Code Modal */}
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
        paddingTop: 60,
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
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingItemText: {
        fontSize: 16,
        color: '#000',
    },
    clearDataButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#ff9500',
        marginTop: 20,
    },
    clearDataButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff9500',
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
