import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { BRAND_NAME } from '../lib/brand';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export function HomePage() {
  const esStaff = useAuthStore((s) => s.esStaff)();
  const showStaffCards = !isSupabaseConfigured || esStaff;

  const sections = [
    {
      to: '/clases',
      title: 'Clases y Docs',
      description: 'Consignas semanales con desbloqueo progresivo y documentación oficial del curso.',
      visible: true,
    },
    {
      to: '/evaluador',
      title: 'Evaluador de PRs',
      description: 'Revisión rápida del diff modificado, Guardián de Rutas y declaración de uso de IA.',
      visible: showStaffCards,
    },
    {
      to: '/libreta',
      title: 'Libreta y Cronograma',
      description: 'Seguimiento de entregas, exámenes eliminatorios (30/40/30) y recuperatorios.',
      visible: true,
    },
    {
      to: '/proyectos',
      title: 'Proyectos de la Cohorte',
      description: 'Galería privada con los MVPs desplegados en producción por los estudiantes.',
      visible: true,
    },
  ];

  return (
    <div className="space-y-10">
      <div className="max-w-2xl space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {BRAND_NAME} · 12 Semanas
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {BRAND_NAME} — Programación Web desde Cero
        </h1>
        <p className="text-base leading-relaxed text-[var(--text-secondary)]">
          Todo el material del curso, las consignas semanales y el seguimiento de entregas en un
          solo lugar. Empezá por la Clase 0 para dejar listo tu entorno y tu primer Pull Request.
        </p>
        <div className="pt-2">
          <Link to="/clases">
            <Button variant="primary">
              Ir a Clases <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections
          .filter((s) => s.visible)
          .map(({ to, title, description }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
                <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {description}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
