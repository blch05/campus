import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

interface ProtectedRouteProps {
  children: ReactNode;
  requireStaff?: boolean;
}

export function ProtectedRoute({ children, requireStaff = false }: ProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const esStaff = useAuthStore((s) => s.esStaff);

  // Si Supabase aún no está configurado en .env, permitimos vista previa local del layout
  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        Verificando sesión...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireStaff && !esStaff()) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">
        <p className="font-semibold">Acceso restringido</p>
        <p className="mt-1 text-rose-200/80">
          Esta sección está disponible únicamente para profesores o administradores.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
