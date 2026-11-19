import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Alumno } from '../types/database';

interface AuthState {
  user: User | null;
  perfil: Alumno | null;
  loading: boolean;
  setSessionUser: (user: User | null) => Promise<void>;
  signOut: () => Promise<void>;
  esProfesor: () => boolean;
  esAdmin: () => boolean;
  esStaff: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  perfil: null,
  loading: isSupabaseConfigured,

  setSessionUser: async (user) => {
    if (!user || !supabase) {
      set({ user: null, perfil: null, loading: false });
      return;
    }

    const { data, error } = await supabase
      .from('alumnos')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      set({ user, perfil: null, loading: false });
      return;
    }

    set({ user, perfil: (data as Alumno | null) ?? null, loading: false });
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, perfil: null, loading: false });
  },

  esProfesor: () => get().perfil?.rol === 'profesor',
  esAdmin: () => Boolean(get().perfil?.es_admin),
  esStaff: () => get().perfil?.rol === 'profesor' || Boolean(get().perfil?.es_admin),
}));
