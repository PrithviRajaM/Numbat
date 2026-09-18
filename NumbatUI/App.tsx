import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { HomeScreen } from '@/screens/HomeScreen';
import { TasksScreen } from '@/screens/TasksScreen';
import { colors } from '@/theme';

/**
 * Single entry point shared by web, Android, and iOS. Platform-specific
 * bootstrapping is handled by Expo; everything below is shared UI.
 *
 * Navigation is intentionally minimal: a single session variable decides
 * whether to show the login (HomeScreen) or the authenticated Tasks page.
 */
export default function App() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {email ? (
        <TasksScreen email={email} />
      ) : (
        <HomeScreen onLoggedIn={setEmail} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brandGreenDeep,
  },
});
