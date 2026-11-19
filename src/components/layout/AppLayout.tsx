import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, ClipboardCheck, GitPullRequest, GraduationCap, Rocket } from 'lucide-react';
import { githubConfig, isGitHubConfigured } from '../../lib/github';
import { isSupabaseConfigured } from '../../lib/supabase';

const navItems = [
  { to: '/', label: 'Inicio', icon: GraduationCap, end: true },
  { to: '/clases', label: 'Clases y Docs', icon: BookOpen },
  { to: '/evaluador', label: 'Evaluador PRs', icon: GitPullRequest },
  { to: '/libreta', label: 'Libreta', icon: ClipboardCheck },
  { to: '/proyectos', label: 'Proyectos', icon: Rocket },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-white">
            <GraduationCap className="h-6 w-6 text-indigo-400" />
            <span>Campus Bootcamp Web TS</span>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
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
