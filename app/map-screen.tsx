import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    WebView
} from 'react-native';

export default function MapScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('Getting location...');

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

  const openGoogleMaps = () => {
    if (location) {
      const { latitude, longitude } = location.coords;
      const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
      Linking.openURL(url);
    }
  };

  const downloadLocation = () => {
    if (location) {
      Alert.alert(
        'Download Location',
        `Location: ${address}\nCoordinates: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Download', 
            onPress: () => {
              // Here you would implement actual download functionality
              Alert.alert('Download', 'Location saved to downloads!');
            }
          }
        ]
      );
    }
  };

  const getMapUrl = () => {
    if (location) {
      const { latitude, longitude } = location.coords;
      return `https://www.google.com/maps/embed/v1/view?key=AIzaSyCD5yBOOEmumJJS8Cge21Tw68UNFzjnUKo&center=${latitude},${longitude}&zoom=15&maptype=roadmap`;
    }
    return `https://www.google.com/maps/embed/v1/view?key=AIzaSyCD5yBOOEmumJJS8Cge21Tw68UNFzjnUKo&center=0,0&zoom=2&maptype=roadmap`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          source={{ uri: getMapUrl() }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
        />
      </View>

      {/* Location Info Overlay */}
      <View style={styles.locationInfo}>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#000" />
            <Text style={styles.locationTitle}>Current Location</Text>
            <TouchableOpacity style={styles.downloadButton} onPress={downloadLocation}>
              <Ionicons name="download" size={20} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={styles.locationAddress}>{address}</Text>
          {location && (
            <Text style={styles.locationCoordinates}>
              {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
            </Text>
          )}
        </View>
      </View>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1,
  },
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
    flex: 1,
  },
  downloadButton: {
    padding: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#999',
  },
});
