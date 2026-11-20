import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Spinner } from '../ui/Skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
  requireStaff?: boolean;
}

export function ProtectedRoute({ children, requireStaff = false }: ProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const perfilLoading = useAuthStore((s) => s.perfilLoading);
  const esStaff = useAuthStore((s) => s.esStaff);

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (loading || (requireStaff && user && perfilLoading)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label={loading ? 'Verificando sesión...' : 'Verificando permisos...'} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (requireStaff && !esStaff()) {
    return (
      <div className="rounded-xl border border-[var(--status-err-border)] bg-[var(--status-err-bg)] p-6 text-sm text-[var(--status-err-fg)]">
        <p className="font-semibold">Acceso restringido</p>
        <p className="mt-1 opacity-85">
          Esta sección está disponible únicamente para profesores o administradores.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
