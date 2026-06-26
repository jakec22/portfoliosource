import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { syncOnLogin, syncOnLogout } from '../services/hydrate';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // PASSWORD_RECOVERY only fires in the implicit flow. Under PKCE the reset
      // link is handled by exchangeCodeForSession (which fires SIGNED_IN), so
      // App.tsx flips the flag via startPasswordReset() instead. Only clear it
      // here on an explicit sign-out so a SIGNED_IN from the code exchange
      // doesn't wipe out the reset state.
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
      } else if (event === 'SIGNED_OUT') {
        setNeedsPasswordReset(false);
      }
      setSession(s);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session && !needsPasswordReset) {
      if (syncedUserId.current !== session.user.id) {
        syncedUserId.current = session.user.id;
        syncOnLogin(session.user.id);
      }
    } else if (!session) {
      syncedUserId.current = null;
      syncOnLogout();
    }
  }, [session, loading, needsPasswordReset]);

  return {
    session,
    loading,
    needsPasswordReset,
    startPasswordReset: () => setNeedsPasswordReset(true),
    clearPasswordReset: () => setNeedsPasswordReset(false),
  };
}
