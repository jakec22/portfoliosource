import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Required so the auth popup dismisses cleanly when it redirects back.
WebBrowser.maybeCompleteAuthSession();

export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email: email.trim(), password });
}

export function signOut() {
  return supabase.auth.signOut();
}

/**
 * Google sign-in via Supabase OAuth. Opens a web auth session, then exchanges
 * the returned PKCE `code` for a Supabase session. Requires the Google provider
 * to be enabled in the Supabase dashboard (Authentication → Providers → Google).
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Could not start Google sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    // User dismissed/cancelled — not an error worth surfacing.
    return;
  }

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }
}
