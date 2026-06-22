import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { syncOnLogin, syncOnLogout } from '../services/hydrate';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires an INITIAL_SESSION event on mount, so we don't
    // need a separate getSession() call.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        syncOnLogin(s.user.id);
      } else if (event === 'SIGNED_OUT') {
        syncOnLogout();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
