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
                tabBarActiveBackgroundColor: 'rgba(0,0,0,0.04)', // Subtle highlight for active tab
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
                        <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    title: 'Maps',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "map" : "map-outline"} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="camera"
                options={{
                    title: 'Camera',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "camera" : "camera-outline"} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="conversation"
                options={{
                    title: 'Conversation',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
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
        height: 72,
        borderRadius: 36,
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
        overflow: 'hidden',
    },
    blurBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 36,
        overflow: 'hidden',
    },
    androidBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF',
        borderRadius: 36,
    },
    tabBarItem: {
        borderRadius: 28,
        marginHorizontal: 8,
        marginVertical: 6,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '700',
        marginTop: -2,
    },
});
