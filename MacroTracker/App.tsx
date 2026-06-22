import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { LogFoodScreen } from './src/screens/LogFoodScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import type { StackScreenProps } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSession } from './src/hooks/useSession';

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

function MainTabs() {
  return (
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
                Home: '🏠',
                History: '📊',
                Profile: '⚙️',
              };
              return (
                <Text style={{ fontSize: focused ? 24 : 20 }}>
                  {icons[route.name] ?? '📋'}
                </Text>
              );
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeStack} />
          <Tab.Screen name="History" component={HistoryScreen} />
          <Tab.Screen name="Profile" component={CalculatorScreen} />
        </Tab.Navigator>
      </NavigationContainer>
  );
}

export default function App() {
  const { session, loading } = useSession();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F9FAFB',
            }}
          >
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : session ? (
          <MainTabs />
        ) : (
          <AuthScreen />
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
