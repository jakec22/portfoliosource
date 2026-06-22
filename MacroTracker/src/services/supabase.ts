// URL polyfill must be imported before supabase-js so fetch/URL work in RN.
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native; we handle OAuth redirects
    // manually via expo-web-browser.
    detectSessionInUrl: false,
    // PKCE flow returns an auth `code` we exchange for a session.
    flowType: 'pkce',
  },
});

// Keep tokens fresh only while the app is foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
