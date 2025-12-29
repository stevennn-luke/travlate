import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('Getting location...');

  console.log('Home screen rendered, user:', user?.email);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to show your current location.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      // Get address from coordinates
      let addressResponse = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addressResponse.length > 0) {
        const addr = addressResponse[0];
        setAddress(`${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.replace(/^,\s*|,\s*$/g, ''));
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setAddress('Unable to get location');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMapPress = () => {
    router.push('/map-screen');
  };

  const handleTextConversion = () => {
    router.push('/text-conversion');
  };

  const handleOCR = () => {
    router.push('/ocr-camera');
  };

  const handleSpeechToText = () => {
    router.push('/voice-to-text');
  };
  const handleProfilePress = () => {
    router.push('/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Logo and Profile */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/image.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <TouchableOpacity style={styles.profileButton} onPress={handleProfilePress}>
          <Ionicons name="person-circle" size={32} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Text */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Welcome, {user?.displayName || user?.email?.split('@')[0] || 'User'}!
          </Text>
        </View>

        {/* Mini Map Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map" size={20} color="#007AFF" />
            <Text style={styles.cardTitle}>Current Location</Text>
          </View>
          <View style={styles.miniMapContainer}>
            <View style={styles.miniMap}>
              <Ionicons name="location" size={32} color="#FF3B30" />
              <Text style={styles.miniMapText}>You are here</Text>
            </View>
            <View style={styles.mapDetails}>
              <Text style={styles.mapAddress}>{address}</Text>
              {location && (
                <Text style={styles.mapCoordinates}>
                  {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.cardAction} onPress={handleMapPress}>
            <Text style={styles.cardActionText}>View Full Map</Text>
            <Ionicons name="chevron-forward" size={16} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Text to Text Conversion Card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardContent} onPress={handleTextConversion}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="language" size={24} color="#34C759" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Text to Text Conversion</Text>
              <Text style={styles.cardDescription}>Translate text between different languages</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* OCR Card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardContent} onPress={handleOCR}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="camera" size={24} color="#FF9500" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>OCR</Text>
              <Text style={styles.cardDescription}>Extract text from images using camera</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Speech to Text Card */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardContent} onPress={handleSpeechToText}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="mic" size={24} color="#AF52DE" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Speech to Text</Text>
              <Text style={styles.cardDescription}>Convert speech into text for translation</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  logo: {
    width: 120,
    height: 40,
  },
  profileButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Inter',
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 0,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  miniMapContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  miniMap: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  miniMapText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  mapDetails: {
    flex: 1,
  },
  mapAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  mapCoordinates: {
    fontSize: 12,
    color: '#999',
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cardActionText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    marginRight: 4,
  },
});