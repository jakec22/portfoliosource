import { create } from 'zustand';
import type { KeyboardTypeOptions } from 'react-native';

/**
 * The app's text prompt.
 *
 * Replaces React Native's `Alert.prompt`, whose entire implementation is
 * `if (Platform.OS === 'ios') { … }` with no else branch — on Android it is a
 * silent no-op, no dialog and no warning. Four features were built on it:
 * resetting a password, naming a saved meal (twice), and importing a shared
 * workout link. All four did nothing at all on Android, the password reset
 * leaving an account with no recovery path.
 *
 * One control on both platforms rather than a system prompt on iOS and this
 * on Android. Divergent dialogs mean divergent validation, and the system one
 * cannot do the thing that matters most here: keep what you typed when it is
 * rejected. Pasting a long link, having it refused, and finding the field
 * empty is the worst moment in any of these flows.
 *
 * Transient, so like the snackbar it lives outside the persisted store — a
 * dialog that survived a cold start would be a bug.
 */

export interface PromptRequest {
  title: string;
  /** One line under the title saying what the value is for. */
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Verb for the confirm button. Names the action, never "OK". */
  submitLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /**
   * Hard cap on what can be typed. Every prompt sets one: a name field with
   * no limit is a row of text that lays out off the side of a card forever.
   */
  maxLength: number;
  /**
   * Checked on submit. Return a message to reject and keep the dialog open
   * with the text intact; return null to accept. Runs after the empty check,
   * so it never sees a blank value.
   */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

interface PromptState {
  request?: PromptRequest;
  show: (request: PromptRequest) => void;
  dismiss: () => void;
}

export const usePrompt = create<PromptState>((set) => ({
  show: (request) => set({ request }),
  dismiss: () => set({ request: undefined }),
}));

/** Imperative entry point, so call sites read like the Alert.prompt they replace. */
export function showPrompt(request: PromptRequest): void {
  usePrompt.getState().show(request);
}
