import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BudgetProvider } from './src/store/useBudget';
import { AppText } from './src/components/ui';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { Colors } from './src/theme/theme';

type Tab = 'dashboard' | 'history' | 'about';

const TABS: { key: Tab; label: string }[] = [
  { key: 'dashboard', label: 'Budget' },
  { key: 'history', label: 'History' },
  { key: 'about', label: 'Plan' },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <AppText style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Root() {
  const [tab, setTab] = useState<Tab>('dashboard');
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        {tab === 'dashboard' && <DashboardScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'about' && <AboutScreen />}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BudgetProvider>
        <Root />
      </BudgetProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.textFaint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: Colors.text,
  },
});
