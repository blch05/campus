import { useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export function useAuthInit() {
  const setSessionUser = useAuthStore((s) => s.setSessionUser);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        void setSessionUser(data.session?.user ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        void setSessionUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSessionUser]);
}
