import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, GitPullRequest, Rocket } from 'lucide-react';

const cards = [
  {
    to: '/clases',
    title: 'Portal de Clases y Docs',
    description: 'Consignas semanales, documentación oficial y presentaciones leídas desde GitHub.',
    icon: BookOpen,
  },
  {
    to: '/evaluador',
    title: 'Evaluador de PRs (Docente)',
    description: 'Auditoría rápida de Pull Requests, Guardián de Rutas y diff limpio de código.',
    icon: GitPullRequest,
  },
  {
    to: '/libreta',
    title: 'Libreta de Notas y Entregas',
    description: 'Seguimiento de cohorte, cálculo 30/40/30 de exámenes y alertas de recuperatorio.',
    icon: ClipboardCheck,
  },
  {
    to: '/proyectos',
    title: 'Galería de MVPs',
    description: 'Productos finales desplegados por los alumnos al completar la Semana 11–12.',
    icon: Rocket,
  },
];

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Bootcamp de Programación Web desde Cero
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Panel centralizado para gestionar las 12 semanas de cursada, auditar Pull Requests por
          diff y llevar el registro de notas y entregas en Supabase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, title, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-indigo-500/60 hover:bg-slate-900"
          >
            <Icon className="h-6 w-6 text-indigo-400 transition group-hover:scale-110" />
            <h2 className="mt-3 text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
