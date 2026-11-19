import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  GitPullRequest,
  GraduationCap,
  LogIn,
  LogOut,
  Rocket,
  Shield,
} from 'lucide-react';
import { githubConfig, isGitHubConfigured } from '../../lib/github';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const perfil = useAuthStore((s) => s.perfil);
  const signOut = useAuthStore((s) => s.signOut);
  const esStaff = useAuthStore((s) => s.esStaff);
  const esAdmin = useAuthStore((s) => s.esAdmin);

  const showStaffNav = !isSupabaseConfigured || esStaff();

  const navItems = [
    { to: '/', label: 'Inicio', icon: GraduationCap, end: true, visible: true },
    { to: '/clases', label: 'Clases y Docs', icon: BookOpen, visible: true },
    { to: '/evaluador', label: 'Evaluador PRs', icon: GitPullRequest, visible: showStaffNav },
    { to: '/libreta', label: 'Libreta', icon: ClipboardCheck, visible: true },
    { to: '/proyectos', label: 'Proyectos', icon: Rocket, visible: true },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-white">
            <GraduationCap className="h-6 w-6 text-indigo-400" />
            <span>Campus Bootcamp Web TS</span>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems
              .filter((item) => item.visible)
              .map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs">
                  <span className="font-medium text-slate-200">
                    {perfil?.nombre ?? user.email}
                  </span>
                  {perfil && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                      {perfil.rol}
                    </span>
                  )}
                  {esAdmin() && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-300">
                      <Shield className="h-3 w-3" />
                      Admin
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <LogIn className="h-3.5 w-3.5" />
                Ingresar
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {(!isGitHubConfigured || !isSupabaseConfigured) && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p className="font-semibold">Configuración pendiente en `.env`</p>
            <p className="mt-1 text-amber-200/80">
              {!isGitHubConfigured && 'Faltan VITE_GITHUB_OWNER / VITE_GITHUB_REPO. '}
              {!isSupabaseConfigured && 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. '}
              Copiá <code>.env.example</code> a <code>.env</code> para conectar los datos reales.
            </p>
          </div>
        )}

        {user && !perfil && isSupabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Tu correo (<code>{user.email}</code>) todavía no está vinculado a un registro en{' '}
            <code>public.alumnos</code>. Pedile al profesor/administrador que cargue tu perfil.
          </div>
        )}

        <Outlet />
      </main>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        {isGitHubConfigured
          ? `Conectado a github.com/${githubConfig.owner}/${githubConfig.repo}`
          : 'Campus Web Modular — React + TypeScript + Tailwind + Supabase'}
      </footer>
    </div>
  );
}
