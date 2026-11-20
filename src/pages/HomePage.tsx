import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, ExternalLink, Video } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { BRAND_NAME } from '../lib/brand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { safeExternalUrl } from '../lib/url';
import { useAuthStore } from '../store/useAuthStore';
import type { Clase, Entrega, Examen } from '../types/database';

function pickProximaClase(clases: Clase[]): Clase | null {
  const activas = clases.filter(
    (c) => (c.estado === 'programada' || c.estado === 'reprogramada') && Boolean(c.fecha_programada),
  );
  if (activas.length === 0) return null;

  const cutoff = Date.now() - 3 * 60 * 60 * 1000; // mantiene el banner hasta 3 hs después del inicio
  const ordenadas = [...activas].sort(
    (a, b) => new Date(a.fecha_programada!).getTime() - new Date(b.fecha_programada!).getTime(),
  );
  return ordenadas.find((c) => new Date(c.fecha_programada!).getTime() >= cutoff) ?? ordenadas[0];
}

function formatFechaProxima(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HomePage() {
  const perfil = useAuthStore((s) => s.perfil);
  const esStaff = useAuthStore((s) => s.esStaff)();
  const showStaffCards = !isSupabaseConfigured || esStaff;

  const clasesQuery = useQuery({
    queryKey: ['supabase', 'clases'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('clases')
        .select('*')
        .order('numero', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Clase[];
    },
  });

  const entregasQuery = useQuery({
    queryKey: ['supabase', 'entregas'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!.from('entregas').select('*');
      if (error) throw error;
      return (data ?? []) as Entrega[];
    },
  });

  const examenesQuery = useQuery({
    queryKey: ['supabase', 'examenes'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!.from('examenes').select('*');
      if (error) throw error;
      return (data ?? []) as Examen[];
    },
  });

  const clases = clasesQuery.data ?? [];
  const proximaClase = pickProximaClase(clases);
  const proximaLink = safeExternalUrl(proximaClase?.link_llamada);
  const totalClases = clases.length || 13;
  const desbloqueadas = clases.filter((c) => c.desbloqueada).length;
  const pctProgreso = Math.round((desbloqueadas / totalClases) * 100);

  // Filtrar entregas y exámenes propios si es estudiante (para staff muestra resumen de cohorte)
  const misEntregas = !esStaff && perfil
    ? (entregasQuery.data ?? []).filter((e) => e.alumno_id === perfil.id)
    : (entregasQuery.data ?? []);

  const aprobadas = misEntregas.filter((e) => e.estado === 'aprobada').length;
  const pctEntregas = misEntregas.length > 0 ? Math.round((aprobadas / misEntregas.length) * 100) : null;

  const misExamenes = !esStaff && perfil
    ? (examenesQuery.data ?? []).filter((ex) => ex.alumno_id === perfil.id && ex.estado !== 'pendiente')
    : (examenesQuery.data ?? []).filter((ex) => ex.estado !== 'pendiente');

  const promedioExamenes =
    misExamenes.length > 0
      ? Math.round(
          (misExamenes.reduce((acc, ex) => acc + Number(ex.nota_final || 0), 0) / misExamenes.length) *
            100,
        ) / 100
      : null;

  const statsLoading =
    isSupabaseConfigured &&
    (clasesQuery.isLoading || entregasQuery.isLoading || examenesQuery.isLoading);

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
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link to="/clases">
            <Button variant="primary">
              Ir a Clases <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/perfil">
            <Button variant="secondary">Mi perfil</Button>
          </Link>
        </div>
      </div>

      {/* Banner de Próxima Clase */}
      {!clasesQuery.isLoading && proximaClase && proximaClase.fecha_programada && (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={proximaClase.estado === 'reprogramada' ? 'warning' : 'success'}>
                {proximaClase.estado === 'reprogramada' ? 'Reprogramada' : 'Próxima clase'}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-[var(--text-secondary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                {formatFechaProxima(proximaClase.fecha_programada)} hs
              </span>
              {proximaClase.modalidad && (
                <span className="text-xs text-[var(--text-muted)]">· {proximaClase.modalidad}</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {proximaClase.titulo}
            </h2>
            {proximaClase.nota_cambio && (
              <p className="text-xs text-[var(--text-secondary)]">{proximaClase.nota_cambio}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {proximaLink && (
              <a href={proximaLink} target="_blank" rel="noreferrer">
                <Button variant="primary" size="sm">
                  <Video className="h-3.5 w-3.5" />
                  Unirse a la llamada
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
            <Link to="/clases">
              <Button variant="secondary" size="sm">
                Ver consigna
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!clasesQuery.isLoading && !proximaClase && esStaff && isSupabaseConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-5 py-3.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            Todavía no hay fecha programada para la próxima clase.
          </span>
          <Link
            to="/libreta?tab=cronograma"
            className="font-medium text-[var(--text-primary)] underline underline-offset-2"
          >
            Programar en Cronograma
          </Link>
        </div>
      )}

      {/* Barra de progreso + métricas de TPs y Exámenes */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Progreso semanal */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:col-span-3 md:col-span-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text-secondary)]">Progreso del curso</span>
            {statsLoading ? (
              <Skeleton className="h-4 w-12" />
            ) : (
              <span className="font-mono font-semibold text-[var(--text-primary)]">
                {pctProgreso}%
              </span>
            )}
          </div>
          {statsLoading ? (
            <Skeleton className="mt-3 h-2 w-full" />
          ) : (
            <>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-300"
                  style={{ width: `${pctProgreso}%` }}
                />
              </div>
              <p className="mt-2.5 text-xs text-[var(--text-muted)]">
                {desbloqueadas} de {totalClases} clases desbloqueadas
              </p>
            </>
          )}
        </div>

        {/* TPs / Entregas */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {esStaff ? 'TPs aprobados (cohorte)' : 'Tus TPs aprobados'}
          </p>
          {statsLoading ? (
            <Skeleton className="mt-2.5 h-7 w-24" />
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                  {pctEntregas !== null ? `${pctEntregas}%` : '—'}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  ({aprobadas}/{misEntregas.length} entregas)
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {misEntregas.length === 0
                  ? 'Sin entregas calificadas todavía'
                  : 'Sobre entregas registradas en Libreta'}
              </p>
            </>
          )}
        </div>

        {/* Promedio de Exámenes */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {esStaff ? 'Promedio exámenes (cohorte)' : 'Promedio de exámenes'}
            </p>
            {!statsLoading && promedioExamenes !== null && (
              <Badge variant={promedioExamenes >= 7 ? 'success' : 'warning'}>
                {promedioExamenes >= 7 ? 'Al día' : '< 7'}
              </Badge>
            )}
          </div>
          {statsLoading ? (
            <Skeleton className="mt-2.5 h-7 w-20" />
          ) : (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                  {promedioExamenes !== null ? promedioExamenes.toFixed(2) : '—'}
                </span>
                <span className="text-xs text-[var(--text-muted)]">/ 10</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {misExamenes.length === 0
                  ? 'Aún sin exámenes evaluados'
                  : `${misExamenes.length} examen(es) evaluado(s) · mínimo 7`}
              </p>
            </>
          )}
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
