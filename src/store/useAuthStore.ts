import { create } from 'zustand';
import type { Alumno } from '../types/database';

interface AuthState {
  perfil: Alumno | null;
  setPerfil: (perfil: Alumno | null) => void;
  esAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  perfil: null,
  setPerfil: (perfil) => set({ perfil }),
  esAdmin: () => get().perfil?.rol === 'admin',
}));
