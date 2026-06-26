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
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsPasswordReset(true);
      } else {
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
    clearPasswordReset: () => setNeedsPasswordReset(false),
  };
}
