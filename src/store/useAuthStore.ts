import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Alumno } from '../types/database';

interface AuthState {
  user: User | null;
  perfil: Alumno | null;
  perfilLoading: boolean;
  perfilError: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  fetchPerfil: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  esProfesor: () => boolean;
  esAdmin: () => boolean;
  esStaff: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  perfil: null,
  perfilLoading: false,
  perfilError: null,
  loading: isSupabaseConfigured,

  setUser: (user) => {
    if (!user) {
      set({ user: null, perfil: null, perfilLoading: false, perfilError: null, loading: false });
      return;
    }
    const prevUserId = get().user?.id;
    set({
      user,
      loading: false,
      perfilLoading: prevUserId !== user.id || !get().perfil,
    });
  },

  fetchPerfil: async (userId) => {
    if (!supabase) return;
    set({ perfilLoading: true, perfilError: null });

    const { data, error } = await supabase
      .from('alumnos')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[WTDev Auth] Error al cargar perfil desde public.alumnos:', error);
      set({
        perfil: null,
        perfilLoading: false,
        perfilError: `${error.code ?? ''} ${error.message}`.trim(),
      });
      return;
    }

    set({
      perfil: (data as Alumno | null) ?? null,
      perfilLoading: false,
      perfilError: null,
    });
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, perfil: null, perfilLoading: false, perfilError: null, loading: false });
  },

  esProfesor: () => get().perfil?.rol === 'profesor',
  esAdmin: () => Boolean(get().perfil?.es_admin),
  esStaff: () => get().perfil?.rol === 'profesor' || Boolean(get().perfil?.es_admin),
}));
