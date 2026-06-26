import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

export function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('reset-password'),
  });
}

export function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

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

export async function deleteAccount(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('delete_user');
    if (error) return { error: new Error(error.message) };
    await supabase.auth.signOut();
    return { error: null };
  } catch (e: any) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** True only on devices/OS versions that support Sign in with Apple (iOS 13+). */
export function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Native Sign in with Apple via Supabase. Apple returns an identity token that
 * we hand to Supabase. We generate a nonce, send Apple its SHA-256 hash, and
 * send Supabase the raw value so it can verify the token wasn't replayed.
 * Requires the Apple provider enabled in Supabase (Authentication → Providers →
 * Apple) with the app's bundle ID listed as an authorized client ID.
 * Resolves false if the user cancels.
 */
export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: any) {
    // The user tapped Cancel on the Apple sheet — not a real error.
    if (e?.code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return true;
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
