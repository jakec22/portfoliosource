import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BudgetProvider, useBudget } from './src/store/useBudget';
import { SignInScreen } from './src/screens/SignInScreen';
import { NotConfiguredScreen } from './src/screens/NotConfiguredScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { Colors } from './src/theme/theme';

function Root() {
  const { configured, session, authLoading, loaded } = useBudget();

  if (!configured) return <NotConfiguredScreen />;

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.text} />
      </View>
    );
  }

  if (!session) return <SignInScreen />;

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.text} />
      </View>
    );
  }

  return <DashboardScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <BudgetProvider>
        <View style={styles.root}>
          <Root />
        </View>
      </BudgetProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
