import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Code2, ExternalLink, FolderGit2, Globe, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import {
  clearGitHubCache,
  isGitHubConfigured,
  listEntregasProyectos,
} from '../lib/github';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { safeExternalUrl } from '../lib/url';
import type { ProyectoCohorte } from '../types/database';

export function ProyectosPage() {
  const [filtroCarpeta, setFiltroCarpeta] = useState<string>('todas');

  const entregasQuery = useQuery({
    queryKey: ['github', 'entregas-proyectos'],
    enabled: isGitHubConfigured,
    queryFn: listEntregasProyectos,
  });

  const proyectosSupabaseQuery = useQuery({
    queryKey: ['supabase', 'proyectos_cohorte'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!.from('proyectos_cohorte').select('*');
      if (error) throw error;
      return (data ?? []) as ProyectoCohorte[];
    },
  });

  const entregas = entregasQuery.data ?? [];
  const mvpsSupabase = proyectosSupabaseQuery.data ?? [];

  const carpetasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const item of entregas) {
      set.add(item.carpeta);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [entregas]);

  const entregasFiltradas = useMemo(() => {
    if (filtroCarpeta === 'todas') return entregas;
    return entregas.filter((e) => e.carpeta === filtroCarpeta);
  }, [entregas, filtroCarpeta]);

  function handleRecargar() {
    clearGitHubCache('entregas-tree:');
    void entregasQuery.refetch();
    void proyectosSupabaseQuery.refetch();
  }

  const isLoading = entregasQuery.isLoading && proyectosSupabaseQuery.isLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Proyectos de la Cohorte
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Galería automática de entregas mergeadas en el repositorio (<code>entregas/</code>) y
            MVPs desplegados de la cohorte.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleRecargar}
          disabled={entregasQuery.isFetching || proyectosSupabaseQuery.isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              entregasQuery.isFetching || proyectosSupabaseQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          Recargar
        </Button>
      </div>

      {/* Sección 1: MVPs desplegados registrados en Supabase (si hay) */}
      {mvpsSupabase.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            MVPs Desplegados
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mvpsSupabase.map((proyecto) => (
              <div
                key={`sb-${proyecto.github_username}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {proyecto.mvp_titulo ?? 'Proyecto Integrador'}
                  </h3>
                  <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    MVP
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {proyecto.nombre} (@{proyecto.github_username})
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium">
                  {safeExternalUrl(proyecto.mvp_url) && (
                    <a
                      href={safeExternalUrl(proyecto.mvp_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--text-primary)] underline underline-offset-2"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Ver App
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {safeExternalUrl(proyecto.mvp_repo_url) && (
                    <a
                      href={safeExternalUrl(proyecto.mvp_repo_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <FolderGit2 className="h-3.5 w-3.5" />
                      Repositorio
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sección 2: Entregas automáticas desde GitHub (entregas/<usuario>/<carpeta>) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Entregas del Repositorio ({entregasFiltradas.length})
          </h2>

          {carpetasDisponibles.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFiltroCarpeta('todas')}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  filtroCarpeta === 'todas'
                    ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Todas
              </button>
              {carpetasDisponibles.map((carpeta) => (
                <button
                  key={carpeta}
                  type="button"
                  onClick={() => setFiltroCarpeta(carpeta)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${
                    filtroCarpeta === carpeta
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {carpeta}
                </button>
              ))}
            </div>
          )}
        </div>

        {entregasQuery.isError && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-300">
            No se pudieron cargar las entregas desde GitHub:{' '}
            {entregasQuery.error instanceof Error
              ? entregasQuery.error.message
              : 'Error desconocido'}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading || entregasQuery.isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
                >
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-4 h-3 w-1/3" />
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3">
                <Spinner label="Buscando entregas en GitHub..." />
              </div>
            </>
          ) : (
            entregasFiltradas.map((entrega) => (
              <div
                key={entrega.id}
                className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {entrega.titulo}
                    </h3>
                    <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                      {entrega.carpeta}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    @{entrega.github_username} · {entrega.archivos}{' '}
                    {entrega.archivos === 1 ? 'archivo' : 'archivos'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium">
                  {safeExternalUrl(entrega.preview_url) && (
                    <a
                      href={safeExternalUrl(entrega.preview_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--text-primary)] underline underline-offset-2"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Ver en vivo
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {safeExternalUrl(entrega.repo_url) && (
                    <a
                      href={safeExternalUrl(entrega.repo_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      Ver código
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}

          {!entregasQuery.isLoading &&
            !entregasQuery.isError &&
            entregasFiltradas.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-sm text-[var(--text-secondary)] sm:col-span-2 lg:col-span-3">
                Todavía no hay entregas mergeadas en <code>entregas/</code>. Ni bien se mergee un
                Pull Request, va a aparecer automáticamente acá.
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
