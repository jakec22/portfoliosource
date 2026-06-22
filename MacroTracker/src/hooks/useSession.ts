import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { syncOnLogin, syncOnLogout } from '../services/hydrate';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which user we've already synced so repeated auth events (token
  // refresh, app foreground) don't re-run the full pull unnecessarily.
  const syncedUserId = useRef<string | null>(null);

  // Effect 1: subscribe to auth changes — only updates React state, no
  // store writes here to avoid calling setState inside another setState.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Effect 2: react to the settled session value. Runs after React has
  // committed the auth state update, so useStore.setState is safe here.
  useEffect(() => {
    if (loading) return;
    if (session) {
      if (syncedUserId.current !== session.user.id) {
        syncedUserId.current = session.user.id;
        syncOnLogin(session.user.id);
      }
    } else {
      syncedUserId.current = null;
      syncOnLogout();
    }
  }, [session, loading]);

  return { session, loading };
}
