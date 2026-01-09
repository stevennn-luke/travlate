import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Keyboard,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteRoute, getSavedRoutes, initDatabase, Route, saveRoute } from '../services/DatabaseService';
import { decodePolyline } from '../utils/polyline';

const { width, height } = Dimensions.get('window');

const CYAN_ACCENT = '#61D8D8';

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);
    const [mapReady, setMapReady] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    // Search States
    const [searchQuery, setSearchQuery] = useState(''); // Destination
    const [startQuery, setStartQuery] = useState('');   // Origin (Empty = My Location)
    const [isRoutingMode, setIsRoutingMode] = useState(false);

    const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
    const [activeRoute, setActiveRoute] = useState<Route | null>(null);
    const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSavedModal, setShowSavedModal] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // Breadcrumb state
    const [isRecordingPath, setIsRecordingPath] = useState(false);
    const [breadcrumbPoints, setBreadcrumbPoints] = useState<{ latitude: number; longitude: number }[]>([]);
    const recordingInterval = useRef<any>(null);

    // Fallback to empty string but log failure if missing
    const GOOGLE_API_KEY = Constants.expoConfig?.android?.config?.googleMaps?.apiKey || Constants.expoConfig?.ios?.config?.googleMapsApiKey || '';

    useEffect(() => {
        if (!GOOGLE_API_KEY) {
            console.error("Google Maps API Key is missing from Expo Config! Directions will not work.");
        } else {
            console.log("Map Loaded with Key (Prefix):", GOOGLE_API_KEY.substring(0, 5) + "...");
        }

        initDatabase();
        getCurrentLocation();
        loadSavedRoutes();

        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!(state.isConnected && state.isInternetReachable));
        });

        return () => {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
            unsubscribe();
        };
    }, []);

    const loadSavedRoutes = () => {
        const routes = getSavedRoutes();
        setSavedRoutes(routes);
    };

    const getCurrentLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location access is required.');
                return;
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setLocation(loc);

            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                }, 1000);
            }
            return loc;
        } catch (error) {
            console.error('Error getting location:', error);
        }
    };

    const resolveLocation = async (query: string): Promise<{ lat: number, lng: number } | null> => {
        if (!query || query.toLowerCase() === 'my location') {
            const tempLoc = await getCurrentLocation();
            return tempLoc ? { lat: tempLoc.coords.latitude, lng: tempLoc.coords.longitude } : null;
        }
        try {
            const geocodeResult = await Location.geocodeAsync(query);
            if (geocodeResult.length > 0) {
                return { lat: geocodeResult[0].latitude, lng: geocodeResult[0].longitude };
            }
        } catch (e) {
            console.warn("Geocoding failed for: " + query);
        }
        return null;
    };

    const handleFetchRoute = async () => {
        if (!searchQuery.trim()) return;
        Keyboard.dismiss();

        if (isOffline) {
            Alert.alert('Offline Mode', 'You are offline. Please select a saved route from your list.');
            setShowSavedModal(true);
            return;
        }

        setIsSearching(true);
        try {
            // 1. Resolve Start Point
            let startCoords;
            if (isRoutingMode && startQuery.trim().length > 0) {
                startCoords = await resolveLocation(startQuery);
            } else {
                startCoords = await resolveLocation('my location');
            }

            if (!startCoords) {
                Alert.alert('Error', 'Could not determine start location.');
                setIsSearching(false);
                return;
            }

            // 2. Resolve End Point
            const endCoords = await resolveLocation(searchQuery);
            if (!endCoords) {
                Alert.alert('Error', 'Could not find destination.');
                setIsSearching(false);
                return;
            }

            // 3. Fetch Directions
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startCoords.lat},${startCoords.lng}&destination=${endCoords.lat},${endCoords.lng}&key=${GOOGLE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.routes.length > 0) {
                const polyline = data.routes[0].overview_polyline.points;
                const points = decodePolyline(polyline);
                setRoutePoints(points);

                const newRoute: Omit<Route, 'id'> = {
                    name: searchQuery, // or `${startQuery || 'Current'} -> ${searchQuery}`
                    startLat: startCoords.lat,
                    startLng: startCoords.lng,
                    endLat: endCoords.lat,
                    endLng: endCoords.lng,
                    polyline: polyline,
                    steps: JSON.stringify(data.routes[0].legs[0].steps),
                    distance: data.routes[0].legs[0].distance.text,
                    duration: data.routes[0].legs[0].duration.text,
                    timestamp: new Date().toISOString()
                };

                const routeObj = { ...newRoute, id: Date.now() };
                setActiveRoute(routeObj);
                setIsNavigating(true);

                mapRef.current?.fitToCoordinates(points, {
                    edgePadding: { top: 180, right: 50, bottom: 200, left: 50 },
                    animated: true
                });

                // Auto-save as requested
                if (isRoutingMode) {
                    saveRoute(newRoute);
                    Alert.alert('Saved', 'Route saved to your list.');
                    loadSavedRoutes();
                }
            } else {
                Alert.alert('Error', `Route calculation failed: ${data.status}`);
            }
        } catch (error) {
            Alert.alert('Error', 'Something went wrong fetching the route.');
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const startRecordingPath = () => {
        setIsRecordingPath(true);
        setBreadcrumbPoints([]);
        Alert.alert('Recording Started', 'Walking path is being tracked. Tap the pulse to save.');

        recordingInterval.current = setInterval(async () => {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setBreadcrumbPoints(prev => [...prev, {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            }]);
        }, 5000);
    };

    const stopAndSavePath = () => {
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
        setIsRecordingPath(false);

        if (breadcrumbPoints.length < 2) {
            Alert.alert('Discarded', 'Path too short to save.');
            setBreadcrumbPoints([]);
            return;
        }

        Alert.prompt(
            'Save Path',
            'Name your recorded path for offline use:',
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setBreadcrumbPoints([]) },
                {
                    text: 'Save',
                    onPress: (name?: string) => {
                        const newRoute: Omit<Route, 'id'> = {
                            name: name || 'Recorded Path',
                            startLat: breadcrumbPoints[0].latitude,
                            startLng: breadcrumbPoints[0].longitude,
                            endLat: breadcrumbPoints[breadcrumbPoints.length - 1].latitude,
                            endLng: breadcrumbPoints[breadcrumbPoints.length - 1].longitude,
                            polyline: JSON.stringify(breadcrumbPoints),
                            steps: '[]',
                            distance: 'Recorded',
                            duration: 'Recorded',
                            timestamp: new Date().toISOString()
                        };
                        saveRoute(newRoute);
                        loadSavedRoutes();
                        setBreadcrumbPoints([]);
                        Alert.alert('Saved', 'Path available offline in your routes list.');
                    }
                }
            ]
        );
    };

    const handleSaveCurrentRoute = () => {
        if (activeRoute) {
            saveRoute(activeRoute);
            Alert.alert('Success', 'Planned route saved for offline use!');
            loadSavedRoutes();
        }
    };

    const handleLoadSaved = (r: Route) => {
        let points;
        try {
            points = r.polyline.startsWith('[') ? JSON.parse(r.polyline) : decodePolyline(r.polyline);
        } catch (e) {
            points = decodePolyline(r.polyline);
        }

        setRoutePoints(points);
        setActiveRoute(r);
        setIsNavigating(true);
        setShowSavedModal(false);
        setSearchQuery(r.name);

        mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
            animated: true
        });
    };

    const cancelNavigation = () => {
        setIsNavigating(false);
        setActiveRoute(null);
        setRoutePoints([]);
        setSearchQuery('');
        setStartQuery('');
        setIsRoutingMode(false);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={true}
                showsMyLocationButton={false}
                mapType="standard"
                userInterfaceStyle="light"
                onPress={() => Keyboard.dismiss()}
                cacheEnabled={true}
                loadingEnabled={true}
            >
                {routePoints.length > 0 && (
                    <Polyline
                        coordinates={routePoints}
                        strokeWidth={5}
                        strokeColor={CYAN_ACCENT}
                        lineCap="round"
                    />
                )}

                {breadcrumbPoints.length > 0 && (
                    <Polyline
                        coordinates={breadcrumbPoints}
                        strokeWidth={5}
                        strokeColor="#FF3B30"
                        lineDashPattern={[5, 5]}
                    />
                )}

                {activeRoute && (
                    <>
                        {/* Start Marker (only if not current location roughly) */}
                        <Marker
                            coordinate={{ latitude: activeRoute.startLat, longitude: activeRoute.startLng }}
                            title="Start"
                            pinColor="green"
                        />
                        {/* End Marker */}
                        <Marker
                            coordinate={{ latitude: activeRoute.endLat, longitude: activeRoute.endLng }}
                            title={activeRoute.name}
                        >
                            <View style={styles.destMarker}>
                                <Ionicons name="location" size={28} color="#FF3B30" />
                            </View>
                        </Marker>
                    </>
                )}
            </MapView>

            <SafeAreaView style={styles.topContainer} edges={['top']}>
                {isOffline && (
                    <View style={styles.offlineBanner}>
                        <Ionicons name="cloud-offline" size={16} color="white" />
                        <Text style={styles.offlineText}>Offline Mode</Text>
                    </View>
                )}

                {!isRoutingMode && !isNavigating ? (
                    // Simple Search Mode
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={isOffline ? "Search unavailable (Offline)" : "Where to?"}
                            placeholderTextColor="#999"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleFetchRoute}
                            editable={!isOffline}
                        />
                        <TouchableOpacity style={styles.listButton} onPress={() => setShowSavedModal(true)}>
                            <Ionicons name="list" size={22} color={CYAN_ACCENT} />
                        </TouchableOpacity>
                        {isSearching && <ActivityIndicator size="small" color={CYAN_ACCENT} style={{ marginLeft: 6 }} />}
                    </View>
                ) : !isNavigating ? (
                    // Point-to-Point Input Mode
                    <View style={styles.routingContainer}>
                        <View style={styles.routingHeader}>
                            <TouchableOpacity onPress={() => setIsRoutingMode(false)} style={{ padding: 4 }}>
                                <Ionicons name="arrow-back" size={24} color="#333" />
                            </TouchableOpacity>
                            <Text style={styles.routingTitle}>Get Directions</Text>
                        </View>

                        <View style={styles.inputRow}>
                            <Ionicons name="radio-button-on" size={16} color="green" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.routingInput}
                                placeholder="My Location"
                                placeholderTextColor="#888"
                                value={startQuery}
                                onChangeText={setStartQuery}
                            />
                        </View>
                        <View style={styles.connectorLine} />
                        <View style={styles.inputRow}>
                            <Ionicons name="location" size={16} color="#FF3B30" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.routingInput}
                                placeholder="Destination"
                                placeholderTextColor="#888"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleFetchRoute}
                                autoFocus={true}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.goButton}
                            onPress={handleFetchRoute}
                            disabled={isSearching}
                        >
                            {isSearching ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="save-outline" size={20} color="white" />
                                    <Text style={styles.goButtonText}>Save Route</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : null}
            </SafeAreaView>

            {/* Navigation Panel */}
            {isNavigating && activeRoute && (
                <View style={styles.navPanel}>
                    <View style={styles.navHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.navDestText} numberOfLines={1}>{activeRoute.name}</Text>
                            <Text style={styles.navDetailText}>{activeRoute.distance} • {activeRoute.duration}</Text>
                        </View>
                        <TouchableOpacity onPress={cancelNavigation} style={{ marginLeft: 10 }}>
                            <Ionicons name="close-circle" size={32} color="#EEE" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.navActions}>
                        <TouchableOpacity style={styles.saveRouteBtn} onPress={handleSaveCurrentRoute}>
                            <Ionicons name="download-outline" size={20} color="white" />
                            <Text style={styles.saveRouteText}>Save Offline</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.startBtn} onPress={() => Alert.alert('Start', 'Follow the path.')}>
                            <Text style={styles.startBtnText}>Start</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {!isRoutingMode && (
                <View style={styles.floatingButtons}>
                    <TouchableOpacity
                        style={[styles.fab, isRecordingPath && styles.fabRecording]}
                        onPress={isRecordingPath ? stopAndSavePath : startRecordingPath}
                    >
                        <Ionicons
                            name={isRecordingPath ? "stop" : "walk-outline"}
                            size={24}
                            color={isRecordingPath ? "white" : CYAN_ACCENT}
                        />
                    </TouchableOpacity>

                    {/* New Routing Trigger Pin */}
                    <TouchableOpacity style={styles.fab} onPress={() => setIsRoutingMode(true)}>
                        <Ionicons name="pin" size={24} color={CYAN_ACCENT} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.fab} onPress={getCurrentLocation}>
                        <Ionicons name="navigate" size={24} color={CYAN_ACCENT} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Saved Routes Modal */}
            <Modal visible={showSavedModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Saved & Recorded</Text>
                            <TouchableOpacity onPress={() => setShowSavedModal(false)}>
                                <Ionicons name="close" size={28} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }}>
                            {savedRoutes.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="map-outline" size={60} color="#EEE" />
                                    <Text style={styles.emptyText}>No paths recorded or saved.</Text>
                                </View>
                            ) : (
                                savedRoutes.map((r) => (
                                    <TouchableOpacity key={r.id} style={styles.routeItem} onPress={() => handleLoadSaved(r)}>
                                        <View style={styles.routeIcon}>
                                            <Ionicons
                                                name={r.distance === 'Recorded' ? "walk" : "location-outline"}
                                                size={20}
                                                color={CYAN_ACCENT}
                                            />
                                        </View>
                                        <View style={styles.routeInfo}>
                                            <Text style={styles.routeName}>{r.name}</Text>
                                            <Text style={styles.routeMeta}>{r.distance} • {r.duration}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => {
                                            deleteRoute(r.id);
                                            loadSavedRoutes();
                                        }}>
                                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EDF1F3',
    },
    map: {
        flex: 1,
    },
    topContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        zIndex: 10,
    },
    offlineBanner: {
        backgroundColor: '#FF3B30',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignSelf: 'center',
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    offlineText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 6,
        fontSize: 12,
    },
    // Simple Search Bar
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 24,
        paddingHorizontal: 16,
        height: 58,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.03)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    iconButton: {
        padding: 8,
    },
    listButton: {
        padding: 8,
        marginLeft: 4,
    },
    // Routing Mode
    routingContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
    routingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    routingTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginLeft: 10,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F7F9',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
        marginBottom: 0,
    },
    routingInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
        height: '100%',
    },
    connectorLine: {
        width: 2,
        height: 12,
        backgroundColor: '#DDD',
        marginLeft: 23,
        marginVertical: 4,
    },
    goButton: {
        backgroundColor: CYAN_ACCENT,
        borderRadius: 16,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        shadowColor: CYAN_ACCENT,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
    },
    goButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 18,
    },
    floatingButtons: {
        position: 'absolute',
        right: 20,
        bottom: 125,
        gap: 8, // Reduced from 15
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    fabRecording: {
        backgroundColor: '#FF3B30',
        borderColor: '#FF3B30',
    },
    destMarker: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navPanel: {
        position: 'absolute',
        bottom: 100,
        left: 15,
        right: 15,
        backgroundColor: 'white',
        borderRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    navHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    navDestText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#333',
        marginBottom: 4,
    },
    navDetailText: {
        fontSize: 15,
        color: '#666',
        fontWeight: '500',
    },
    navActions: {
        flexDirection: 'row',
        gap: 12,
    },
    saveRouteBtn: {
        flex: 1,
        backgroundColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 18,
        gap: 8,
    },
    saveRouteText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
    startBtn: {
        flex: 1,
        backgroundColor: CYAN_ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 18,
    },
    startBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        height: height * 0.7,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#333',
    },
    routeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F5F5F5',
    },
    routeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EDF1F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    routeInfo: {
        flex: 1,
    },
    routeName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 4,
    },
    routeMeta: {
        fontSize: 13,
        color: '#999',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        color: '#CCC',
        textAlign: 'center',
    },
});
