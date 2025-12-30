import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('travlate.db');

export interface OCRScan {
    id: number;
    text: string;
    imageUri: string;
    timestamp: string;
}

export interface Translation {
    id: number;
    sourceText: string;
    targetText: string;
    sourceLang: string;
    targetLang: string;
    timestamp: string;
}

export interface VoiceNote {
    id: number;
    transcription: string;
    timestamp: string;
}

export interface UserProfile {
    id: string; // Firebase UID
    name: string;
    email: string | null;
    phoneNumber: string | null;
    selectedVoice: string | null;
    notificationsEnabled: number; // 0 or 1
    voiceAssistantEnabled: number; // 0 or 1
    appLockEnabled: number; // 0 or 1
    updatedAt: string;
}

export interface Route {
    id: number;
    name: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    polyline: string; // JSON string of coordinates
    steps: string; // JSON string of navigation steps
    distance: string;
    duration: string;
    timestamp: string;
}

export const initDatabase = () => {
    try {
        db.execSync(`
      CREATE TABLE IF NOT EXISTS ocr_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        imageUri TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
        db.execSync(`
      CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sourceText TEXT NOT NULL,
        targetText TEXT NOT NULL,
        sourceLang TEXT NOT NULL,
        targetLang TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
        db.execSync(`
      CREATE TABLE IF NOT EXISTS voice_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transcription TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
        db.execSync(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        email TEXT,
        phoneNumber TEXT,
        selectedVoice TEXT,
        notificationsEnabled INTEGER DEFAULT 1,
        voiceAssistantEnabled INTEGER DEFAULT 1,
        appLockEnabled INTEGER DEFAULT 0,
        updatedAt TEXT
      );
    `);
        db.execSync(`
      CREATE TABLE IF NOT EXISTS saved_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        startLat REAL NOT NULL,
        startLng REAL NOT NULL,
        endLat REAL NOT NULL,
        endLng REAL NOT NULL,
        polyline TEXT NOT NULL,
        steps TEXT NOT NULL,
        distance TEXT NOT NULL,
        duration TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );
    `);
        console.log('Database initialized');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};

export const saveScan = (text: string, imageUri: string) => {
    try {
        const timestamp = new Date().toISOString();
        db.runSync(
            'INSERT INTO ocr_scans (text, imageUri, timestamp) VALUES (?, ?, ?)',
            text,
            imageUri,
            timestamp
        );
        console.log('Scan saved');
    } catch (error) {
        console.error('Failed to save scan:', error);
        throw error;
    }
};

export const getScans = (): OCRScan[] => {
    try {
        const result = db.getAllSync<OCRScan>('SELECT * FROM ocr_scans ORDER BY timestamp DESC');
        return result;
    } catch (error) {
        console.error('Failed to get scans:', error);
        return [];
    }
};

export const deleteScan = (id: number) => {
    try {
        db.runSync('DELETE FROM ocr_scans WHERE id = ?', id);
    } catch (error) {
        console.error('Failed to delete scan:', error);
        throw error;
    }
};

export const saveTranslation = (sourceText: string, targetText: string, sourceLang: string, targetLang: string) => {
    try {
        const timestamp = new Date().toISOString();
        db.runSync(
            'INSERT INTO translations (sourceText, targetText, sourceLang, targetLang, timestamp) VALUES (?, ?, ?, ?, ?)',
            sourceText,
            targetText,
            sourceLang,
            targetLang,
            timestamp
        );
        console.log('Translation saved');
    } catch (error) {
        console.error('Failed to save translation:', error);
        throw error;
    }
};

export const getTranslations = (): Translation[] => {
    try {
        const result = db.getAllSync<Translation>('SELECT * FROM translations ORDER BY timestamp DESC');
        return result;
    } catch (error) {
        console.error('Failed to get translations:', error);
        return [];
    }
};

export const deleteTranslation = (id: number) => {
    try {
        db.runSync('DELETE FROM translations WHERE id = ?', id);
    } catch (error) {
        console.error('Failed to delete translation:', error);
        throw error;
    }
};

export const saveVoiceNote = (transcription: string) => {
    try {
        const timestamp = new Date().toISOString();
        db.runSync(
            'INSERT INTO voice_notes (transcription, timestamp) VALUES (?, ?)',
            transcription,
            timestamp
        );
        console.log('Voice note saved');
    } catch (error) {
        console.error('Failed to save voice note:', error);
        throw error;
    }
};

export const getVoiceNotes = (): VoiceNote[] => {
    try {
        const result = db.getAllSync<VoiceNote>('SELECT * FROM voice_notes ORDER BY timestamp DESC');
        return result;
    } catch (error) {
        console.error('Failed to get voice notes:', error);
        return [];
    }
};

export const deleteVoiceNote = (id: number) => {
    try {
        db.runSync('DELETE FROM voice_notes WHERE id = ?', id);
    } catch (error) {
        console.error('Failed to delete voice note:', error);
        throw error;
    }
};

export const saveLocalUserProfile = (profile: UserProfile) => {
    try {
        db.runSync(
            `INSERT OR REPLACE INTO user_profiles (
                id, name, email, phoneNumber, selectedVoice, 
                notificationsEnabled, voiceAssistantEnabled, appLockEnabled, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            profile.id,
            profile.name,
            profile.email,
            profile.phoneNumber,
            profile.selectedVoice,
            profile.notificationsEnabled,
            profile.voiceAssistantEnabled,
            profile.appLockEnabled,
            profile.updatedAt
        );
        console.log('User profile saved locally');
    } catch (error) {
        console.error('Failed to save user profile:', error);
    }
};

export const getLocalUserProfile = (userId: string): UserProfile | null => {
    try {
        const result = db.getFirstSync<UserProfile>('SELECT * FROM user_profiles WHERE id = ?', userId);
        return result || null;
    } catch (error) {
        console.error('Failed to get user profile:', error);
        return null;
    }
};

export const saveRoute = (route: Omit<Route, 'id'>) => {
    try {
        db.runSync(
            `INSERT INTO saved_routes (name, startLat, startLng, endLat, endLng, polyline, steps, distance, duration, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            route.name,
            route.startLat,
            route.startLng,
            route.endLat,
            route.endLng,
            route.polyline,
            route.steps,
            route.distance,
            route.duration,
            route.timestamp
        );
        console.log('Route saved locally');
    } catch (error) {
        console.error('Failed to save route:', error);
        throw error;
    }
};

export const getSavedRoutes = (): Route[] => {
    try {
        const result = db.getAllSync<Route>('SELECT * FROM saved_routes ORDER BY timestamp DESC');
        return result;
    } catch (error) {
        console.error('Failed to get saved routes:', error);
        return [];
    }
};

export const deleteRoute = (id: number) => {
    try {
        db.runSync('DELETE FROM saved_routes WHERE id = ?', id);
    } catch (error) {
        console.error('Failed to delete route:', error);
        throw error;
    }
};

export const clearLocalDatabase = () => {
    try {
        db.execSync('DELETE FROM ocr_scans');
        db.execSync('DELETE FROM translations');
        db.execSync('DELETE FROM voice_notes');
        db.execSync('DELETE FROM user_profiles');
        db.execSync('DELETE FROM saved_routes');
        console.log('Local database cleared');
    } catch (error) {
        console.error('Failed to clear local database:', error);
    }
};
