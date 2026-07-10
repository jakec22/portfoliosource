// Stores the user's own Anthropic API key on-device via the OS keychain
// (expo-secure-store) — never bundled into the app, never sent anywhere but
// api.anthropic.com. This is a bring-your-own-key feature: there is no
// backend, and the key never leaves the device except in requests the user
// initiates directly to Anthropic.

import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'clover-budget-anthropic-api-key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEY);
}

export async function setApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, value.trim());
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
