import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogIn, LogOut, Moon, Shield, Sun } from 'lucide-react';
import { BRAND_NAME } from '../../lib/brand';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { TeacherAuditOverlay } from '../audit/TeacherAuditOverlay';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

export function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const perfil = useAuthStore((s) => s.perfil);
  const perfilLoading = useAuthStore((s) => s.perfilLoading);
  const perfilError = useAuthStore((s) => s.perfilError);
  const signOut = useAuthStore((s) => s.signOut);
  const esStaff = useAuthStore((s) => s.esStaff);
  const esAdmin = useAuthStore((s) => s.esAdmin);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const showStaffNav = !isSupabaseConfigured || esStaff();
  const isFullBleedPage =
    location.pathname.startsWith('/clases') || location.pathname.endsWith('/diff');

  const navItems = [
    { to: '/', label: 'Inicio', end: true, visible: true },
    { to: '/clases', label: 'Clases', visible: true },
    { to: '/evaluador', label: 'Evaluador PRs', visible: showStaffNav },
    { to: '/libreta', label: 'Libreta', visible: true },
    { to: '/proyectos', label: 'Proyectos', visible: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-30 h-14 border-b border-[var(--border)] bg-[var(--bg-canvas)]/95 backdrop-blur">
        <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex h-full min-w-0 flex-1 items-center gap-4 md:gap-8">
            <Link
              to="/"
              className="shrink-0 text-sm font-semibold tracking-tight text-[var(--text-primary)]"
            >
              {BRAND_NAME}
            </Link>

            <nav
              className="flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Navegación principal"
            >
              {navItems
                .filter((item) => item.visible)
                .map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `relative inline-flex h-full items-center px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--text-primary)] ${
                        isActive
                          ? 'font-medium text-[var(--text-primary)] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Cambiar a modo oscuro OLED' : 'Cambiar a modo claro'}
              title={theme === 'light' ? 'Modo oscuro OLED' : 'Modo claro'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {user ? (
              <>
                {perfilLoading ? (
                  <div
                    aria-label="Cargando perfil"
                    className="hidden h-7 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 sm:flex"
                  >
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ) : (
                  <Link
                    to="/perfil"
                    title="Ver mi perfil"
                    className="hidden items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] sm:flex"
                  >
                    <span className="font-medium text-[var(--text-primary)]">
                      {perfil?.nombre ?? user.email}
                    </span>
                    {perfil && (
                      <span className="text-[var(--text-secondary)]">· {perfil.rol}</span>
                    )}
                    {esAdmin() && (
                      <span className="inline-flex items-center gap-0.5 font-medium text-[var(--text-primary)]">
                        · <Shield className="h-3 w-3" /> Admin
                      </span>
                    )}
                  </Link>
                )}

                <Button variant="secondary" size="sm" onClick={() => void signOut()}>
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">
                  <LogIn className="h-3.5 w-3.5" />
                  Ingresar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={isFullBleedPage ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-6 py-10'}>
        {user && !perfil && !perfilLoading && isSupabaseConfigured && (
          <div className="mx-auto mb-6 max-w-3xl rounded-lg border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] px-4 py-3 text-sm text-[var(--status-warn-fg)]">
            {perfilError ? (
              <>
                Error al leer tu perfil desde Supabase: <code>{perfilError}</code>
              </>
            ) : (
              <>
                Tu correo (<code>{user.email}</code>) todavía no está vinculado a un registro en{' '}
                <code>public.alumnos</code>. Pedile al profesor/administrador que cargue tu perfil.
              </>
            )}
          </div>
        )}

        <Outlet />
      </main>

      {showStaffNav && <TeacherAuditOverlay />}
    </div>
  );
}
