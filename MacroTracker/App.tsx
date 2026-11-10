import React, { useEffect } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavLightTheme,
  DarkTheme as NavDarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StatusBar, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useTheme } from './src/theme/useTheme';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from './src/components/TabIcon';
import { Snackbar } from './src/components/Snackbar';
import { HomeScreen } from './src/screens/HomeScreen';
import { LogFoodScreen } from './src/screens/LogFoodScreen';
import { MealPhotoScreen } from './src/screens/MealPhotoScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { FoodScreen } from './src/screens/FoodScreen';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { WorkoutTemplateScreen } from './src/screens/WorkoutTemplateScreen';
import { ActiveWorkoutScreen } from './src/screens/ActiveWorkoutScreen';
import { WorkoutSummaryScreen } from './src/screens/WorkoutSummaryScreen';
import { ExerciseProgressScreen } from './src/screens/ExerciseProgressScreen';
import { KeyInsightsScreen } from './src/screens/KeyInsightsScreen';
import { BuildMealScreen } from './src/screens/BuildMealScreen';
import { GoalWizardScreen } from './src/screens/GoalWizardScreen';
import { RecoveryTimerScreen } from './src/screens/RecoveryTimerScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSession } from './src/hooks/useSession';
import { useTemplateImport } from './src/hooks/useTemplateImport';
import { useWatchSync } from './src/hooks/useWatchSync';
import { useWidgetSync } from './src/hooks/useWidgetSync';
import { useWatchWorkout } from './src/hooks/useWatchWorkout';
import { navigationRef } from './src/services/navigation';
import { supabase } from './src/services/supabase';
import { useStore } from './src/store/useStore';
import {
  configureNotificationHandler,
  applyReminderSchedule,
} from './src/services/notifications';

// Set how notifications are presented while the app is foregrounded. Done at
// module load so it's in place before the first notification can fire.
configureNotificationHandler();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      {/* History lost its tab to Food and is pushed from Home's week strip.
          Its day cards are too heavy for a glance surface, so the dashboard
          shows the week and this holds every day before it. */}
      <Stack.Screen name="History" component={HistoryScreen as any} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen as any} />
      <Stack.Screen name="KeyInsights" component={KeyInsightsScreen as any} />
      <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen as any} />
      {/* Registered here as well as in ProfileStack, because Home's "set up
          goals" card pushes it. This app registers a shared screen in every
          stack that reaches it rather than leaning on React Navigation
          finding the name in a sibling navigator — KeyInsights sits in four
          stacks for the same reason. */}
      <Stack.Screen
        name="GoalWizard"
        component={GoalWizardScreen as any}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

// Everything that writes a food entry lives behind the Food tab.
function FoodStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FoodHome" component={FoodScreen as any} />
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
      <Stack.Screen
        name="BuildMeal"
        component={BuildMealScreen as any}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="KeyInsights" component={KeyInsightsScreen as any} />
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
      <Stack.Screen name="KeyInsights" component={KeyInsightsScreen as any} />
      <Stack.Screen
        name="RecoveryTimer"
        component={RecoveryTimerScreen as any}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={CalculatorScreen as any} />
      <Stack.Screen name="KeyInsights" component={KeyInsightsScreen as any} />
      <Stack.Screen name="ExerciseProgress" component={ExerciseProgressScreen as any} />
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
  // Mirror today's calories/macros/water to the Apple Watch glance.
  useWatchSync();
  // Mirror the active workout's exercises/sets to the watch.
  useWatchWorkout();
  // Mirror today's calories/macros to the home screen widget.
  useWidgetSync();

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
    <NavigationContainer theme={navTheme} ref={navigationRef}>
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
                name={route.name as 'Home' | 'Food' | 'Exercise' | 'Profile'}
                color={color}
                size={focused ? 28 : 24}
              />
            ),
          })}
        >
          <Tab.Screen name="Home" component={HomeStack} />
          <Tab.Screen name="Food" component={FoodStack} />
          <Tab.Screen name="Exercise" component={ExerciseStack} />
          <Tab.Screen name="Profile" component={ProfileStack} />
        </Tab.Navigator>
      </NavigationContainer>
  );
}

export default function App() {
  const {
    session,
    loading,
    needsPasswordReset,
    startPasswordReset,
    clearPasswordReset,
  } = useSession();
  const c = useTheme();
  const url = Linking.useURL();
  const notificationPrefs = useStore((s) => s.notificationPrefs);

  // Load every theme pack's custom fonts up front (small — a dozen files
  // total) so switching packs never needs a reload or shows a font swap.
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    ArchivoBlack_400Regular,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Keep the OS-scheduled reminders in sync with the saved preferences. Runs on
  // launch (so they persist across reboots) and whenever the prefs change.
  useEffect(() => {
    applyReminderSchedule(notificationPrefs);
  }, [notificationPrefs]);

  // Handle the reset-password deep link. With a custom scheme,
  // holymacro://reset-password?code=... parses "reset-password" as the
  // hostname (not the path), so accept either. Under the PKCE flow the code
  // exchange fires SIGNED_IN (not PASSWORD_RECOVERY), so we explicitly flip
  // into the reset screen ourselves once the session is established.
  useEffect(() => {
    if (!url) return;
    const { hostname, path, queryParams } = Linking.parse(url);
    // With a custom scheme, holymacro://<route>?... parses <route> as the
    // hostname (not the path), so accept either.
    const route = path ?? hostname;

    if (route === 'reset-password') {
      if (typeof queryParams?.code === 'string') {
        supabase.auth.exchangeCodeForSession(queryParams.code).then(({ error }) => {
          if (error) {
            Alert.alert('Reset link problem', error.message);
          } else {
            startPasswordReset();
          }
        });
      } else if (typeof queryParams?.error_description === 'string') {
        Alert.alert('Reset link problem', String(queryParams.error_description));
      }
      return;
    }

    // New-account email confirmation. The link opens in the browser, verifies
    // the address with Supabase, and redirects back here with a PKCE code. We
    // exchange it for a session — SIGNED_IN then drops the user into the app.
    if (route === 'auth-callback') {
      if (typeof queryParams?.code === 'string') {
        supabase.auth.exchangeCodeForSession(queryParams.code).then(({ error }) => {
          if (error) Alert.alert('Confirmation link problem', error.message);
        });
      } else if (typeof queryParams?.error_description === 'string') {
        Alert.alert('Confirmation link problem', String(queryParams.error_description));
      }
    }
  }, [url]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
        {loading || !fontsLoaded ? (
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
        ) : needsPasswordReset ? (
          <ResetPasswordScreen onDone={clearPasswordReset} />
        ) : session ? (
          <MainTabs />
        ) : (
          <AuthScreen />
        )}
        {/* One instance for the whole app, over the tab bar. */}
        <Snackbar />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
