import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { LogFoodScreen } from './src/screens/LogFoodScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import type { StackScreenProps } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="LogFood"
        component={LogFoodScreen as any}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#10B981',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopColor: '#F3F4F6',
              paddingBottom: 8,
              paddingTop: 6,
              height: 60,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            tabBarIcon: ({ focused, color }) => {
              const icons: Record<string, string> = {
                Today: '🏠',
                History: '📊',
                Goals: '⚙️',
              };
              return (
                <Text style={{ fontSize: focused ? 24 : 20 }}>
                  {icons[route.name] ?? '📋'}
                </Text>
              );
            },
          })}
        >
          <Tab.Screen name="Today" component={HomeStack} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Goals" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
