import { useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export function useAuthInit() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchPerfil = useAuthStore((s) => s.fetchPerfil);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setUser(data.session?.user ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser]);

  // Cargar perfil fuera del callback de onAuthStateChange para evitar lock de Supabase JS v2
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    void fetchPerfil(user.id);
  }, [user?.id, fetchPerfil]);
}
