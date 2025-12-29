import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string>('');

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

      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // Smoothly animate and zoom to location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005, // Zoomed in for detail
          longitudeDelta: 0.005,
        }, 1000);
      }

      // Get address from coordinates
      let addressResponse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (addressResponse.length > 0) {
        const addr = addressResponse[0];
        setAddress(`${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`.replace(/^,\s*|,\s*$/g, ''));
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const getRegion = () => {
    // We return a default implementation but rely on animateToRegion for updates
    return {
      latitude: 8.8932,
      longitude: 76.5841,
      latitudeDelta: 0.015,
      longitudeDelta: 0.0121,
    };
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full Screen Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={getRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false} // We implement custom button below
        mapType="hybrid" // Matches satellite/hybrid view in screenshot
        toolbarEnabled={false}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="My Location"
            description={address}
          >
            <View style={styles.myLocationMarker}>
              <View style={styles.myLocationDot} />
              <View style={styles.myLocationHalo} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top Search Bar */}
      <SafeAreaView style={styles.topContainer} edges={['top']}>
        {/* Weather/Status Overlay */}
        <View style={styles.weatherOverlay}>
          <Ionicons name="partly-sunny" size={24} color="#fff" />
          <View>
            <Text style={styles.weatherTemp}>27°</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom Controls */}
      <SafeAreaView style={styles.bottomContainer} edges={['bottom']}>

        {/* Right Side Floating Buttons */}
        <View style={styles.floatingButtons}>
          <TouchableOpacity style={styles.fab} onPress={getCurrentLocation}>
            <Ionicons name="navigate-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Apple Maps"
            placeholderTextColor="#ccc"
            value="Search Maps"
            editable={false}
          />
          <TouchableOpacity style={styles.micButton}>
            <Ionicons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
    paddingTop: 16
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent black
    padding: 8,
    borderRadius: 12,
  },
  weatherTemp: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  floatingButtons: {
    position: 'absolute',
    right: 16,
    bottom: 100, // Above search bar
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30,30,30,0.85)', // Dark gray translucent
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e', // Dark gray card
    borderRadius: 30,
    padding: 6,
    height: 60,
  },
  searchIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    height: '100%',
  },
  micButton: {
    padding: 10,
    marginRight: 8,
  },
  // Custom Marker
  myLocationMarker: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    zIndex: 2,
    borderWidth: 2,
    borderColor: 'white',
  },
  myLocationHalo: {
    position: 'absolute',
    width: 40, // large halo
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,122,255,0.3)', // Light blue transparent
  }
});
