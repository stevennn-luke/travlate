import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#61D8D8',
                tabBarInactiveTintColor: '#333',
                tabBarActiveBackgroundColor: 'transparent',
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarItemStyle: styles.tabBarItem,
                tabBarBackground: () => (
                    Platform.OS === 'ios' ? (
                        <BlurView intensity={100} tint="light" style={styles.blurBackground} />
                    ) : (
                        <View style={styles.androidBackground} />
                    )
                ),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Translate',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={27} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'Maps',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "map" : "map-outline"} size={27} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="camera"
                options={{
                    title: 'Camera',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "camera" : "camera-outline"} size={27} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="conversation"
                options={{
                    title: 'Confab',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "people" : "people-outline"} size={27} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        height: 78,
        borderRadius: 39,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderTopWidth: 0,
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        paddingBottom: 0,
        paddingTop: 9,
        paddingHorizontal: 15,
        overflow: 'hidden',
    },
    blurBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 39,
        overflow: 'hidden',
    },
    androidBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        borderRadius: 39,
    },
    tabBarItem: {
        borderRadius: 38,
        marginHorizontal: 0,
        marginVertical: 4,
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: 5,
        textAlign: 'center',
    },
});
