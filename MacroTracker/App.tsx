import React from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLightTheme,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { useTheme } from './src/theme/useTheme';
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
import { WorkoutSummaryScreen } from './src/screens/WorkoutSummaryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { BuildMealScreen } from './src/screens/BuildMealScreen';
import { GoalWizardScreen } from './src/screens/GoalWizardScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import type { StackScreenProps } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSession } from './src/hooks/useSession';
import { useTemplateImport } from './src/hooks/useTemplateImport';

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
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen as any} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen as any} />
      <Stack.Screen
        name="BuildMeal"
        component={BuildMealScreen as any}
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
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen as any} />
      <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen as any} />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryHome" component={HistoryScreen as any} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen as any} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen as any} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={CalculatorScreen as any} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen as any} />
      <Stack.Screen
        name="GoalWizard"
        component={GoalWizardScreen as any}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  // Handle incoming "import-template" share links once the user is in the app.
  useTemplateImport();

  const navTheme = {
    ...(c.scheme === 'dark' ? NavDarkTheme : NavLightTheme),
    colors: {
      ...(c.scheme === 'dark' ? NavDarkTheme : NavLightTheme).colors,
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
      primary: c.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: c.primary,
            tabBarInactiveTintColor: c.textFaint,
            tabBarStyle: {
              backgroundColor: c.card,
              borderTopColor: c.border,
              paddingBottom: insets.bottom + 6,
              paddingTop: 6,
              height: 52 + insets.bottom,
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
          <Tab.Screen name="History" component={HistoryStack} />
          <Tab.Screen name="Profile" component={ProfileStack} />
        </Tab.Navigator>
      </NavigationContainer>
  );
}

export default function App() {
  const { session, loading } = useSession();
  const c = useTheme();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.bg,
            }}
          >
            <ActivityIndicator size="large" color={c.primary} />
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
