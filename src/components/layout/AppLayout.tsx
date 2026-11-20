import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogIn, LogOut, Moon, Shield, Sun } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Button } from '../ui/Button';

export function AppLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const perfil = useAuthStore((s) => s.perfil);
  const signOut = useAuthStore((s) => s.signOut);
  const esStaff = useAuthStore((s) => s.esStaff);
  const esAdmin = useAuthStore((s) => s.esAdmin);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const showStaffNav = !isSupabaseConfigured || esStaff();
  const isFullBleedPage = location.pathname.startsWith('/clases');

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
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-sm font-semibold tracking-tight text-[var(--text-primary)]"
            >
              Bootcamp Web TS
            </Link>

            <nav className="flex items-center gap-1" aria-label="Navegación principal">
              {navItems
                .filter((item) => item.visible)
                .map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `relative px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] ${
                        isActive
                          ? 'font-medium text-[var(--text-primary)] after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[2px] after:bg-[var(--text-primary)]'
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
                <div className="hidden items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs sm:flex">
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
                </div>
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
        {user && !perfil && isSupabaseConfigured && (
          <div className="mx-auto mb-6 max-w-3xl rounded-lg border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] px-4 py-3 text-sm text-[var(--status-warn-fg)]">
            Tu correo (<code>{user.email}</code>) todavía no está vinculado a un registro en{' '}
            <code>public.alumnos</code>. Pedile al profesor/administrador que cargue tu perfil.
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}
