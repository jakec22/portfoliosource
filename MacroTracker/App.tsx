import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from './src/components/TabIcon';
import { HomeScreen } from './src/screens/HomeScreen';
import { LogFoodScreen } from './src/screens/LogFoodScreen';
import { MealPhotoScreen } from './src/screens/MealPhotoScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { WorkoutTemplateScreen } from './src/screens/WorkoutTemplateScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
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
      <Stack.Screen
        name="MealPhoto"
        component={MealPhotoScreen as any}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

function ExerciseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExerciseHome" component={ExerciseScreen as any} />
      <Stack.Screen
        name="WorkoutTemplate"
        component={WorkoutTemplateScreen as any}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen as any} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
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
              paddingBottom: insets.bottom + 10,
              paddingTop: 10,
              height: 64 + insets.bottom,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            tabBarIcon: ({ focused, color }) => (
              <TabIcon
                name={route.name as 'Home' | 'Exercise' | 'History' | 'Profile'}
                color={color}
                size={focused ? 28 : 24}
              />
            ),
          })}
        >
          <Tab.Screen name="Home" component={HomeStack} />
          <Tab.Screen name="Exercise" component={ExerciseStack} />
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
