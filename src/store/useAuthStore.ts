import { create } from 'zustand';
import type { Alumno } from '../types/database';

interface AuthState {
  perfil: Alumno | null;
  setPerfil: (perfil: Alumno | null) => void;
  esProfesor: () => boolean;
  esAdmin: () => boolean;
  esStaff: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  perfil: null,
  setPerfil: (perfil) => set({ perfil }),
  esProfesor: () => get().perfil?.rol === 'profesor',
  esAdmin: () => Boolean(get().perfil?.es_admin),
  esStaff: () => get().perfil?.rol === 'profesor' || Boolean(get().perfil?.es_admin),
}));
