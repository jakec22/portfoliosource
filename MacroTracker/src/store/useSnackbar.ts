import { create } from 'zustand';

// Transient, so it lives in its own store rather than in the persisted app
// state — a snackbar that survived a cold start would be a bug.
//
// Exists so destructive actions can be recoverable instead of interrupting.
// Confirming a delete costs a tap on every delete, including the ones the user
// meant, and still loses the data when the confirmation is tapped through on
// autopilot. Deleting straight away and offering Undo costs nothing on the
// common path and is survivable on the rare one.

export const SNACKBAR_MS = 5000;

interface SnackbarState {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Identifies the current snackbar, so a stale timer cannot close a newer one. */
  token: number;
  show: (message: string, action?: { label: string; onPress: () => void }) => void;
  runAction: () => void;
  dismiss: (token?: number) => void;
}

export const useSnackbar = create<SnackbarState>((set, get) => ({
  token: 0,

  show: (message, action) =>
    set((s) => ({
      message,
      actionLabel: action?.label,
      onAction: action?.onPress,
      token: s.token + 1,
    })),

  runAction: () => {
    const { onAction } = get();
    set({ message: undefined, actionLabel: undefined, onAction: undefined });
    onAction?.();
  },

  // A token means the auto-dismiss timer from an earlier snackbar cannot close
  // the one that replaced it.
  dismiss: (token) =>
    set((s) =>
      token != null && token !== s.token
        ? s
        : { message: undefined, actionLabel: undefined, onAction: undefined }
    ),
}));
