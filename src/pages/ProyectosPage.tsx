import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { safeExternalUrl } from '../lib/url';
import type { ProyectoCohorte } from '../types/database';

export function ProyectosPage() {
  const proyectosQuery = useQuery({
    queryKey: ['supabase', 'proyectos_cohorte'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!.from('proyectos_cohorte').select('*');
      if (error) throw error;
      return (data ?? []) as ProyectoCohorte[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Proyectos de la Cohorte
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Galería privada de MVPs desplegados por los estudiantes (solo visible para usuarios
          autenticados).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectosQuery.isLoading ? (
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
              <Spinner label="Cargando proyectos de la cohorte..." />
            </div>
          </>
        ) : (
          proyectosQuery.data?.map((proyecto) => (
          <div
            key={proyecto.github_username}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
          >
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {proyecto.mvp_titulo ?? 'Proyecto Integrador'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {proyecto.nombre} (@{proyecto.github_username})
            </p>
            <div className="mt-4 flex gap-4 text-xs font-medium">
              {safeExternalUrl(proyecto.mvp_url) && (
                <a
                  href={safeExternalUrl(proyecto.mvp_url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--text-primary)] underline underline-offset-2"
                >
                  Ver App <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {safeExternalUrl(proyecto.mvp_repo_url) && (
                <a
                  href={safeExternalUrl(proyecto.mvp_repo_url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Repositorio <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        ))
        )}

        {!proyectosQuery.isLoading && (!proyectosQuery.data || proyectosQuery.data.length === 0) && (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] p-8 text-sm text-[var(--text-secondary)] sm:col-span-2 lg:col-span-3">
            Todavía no hay MVPs publicados. En la Semana 11 los alumnos emancipan su proyecto a su
            propio repositorio y lo despliegan en Vercel + Render.
          </div>
        )}
      </div>
    </div>
  );
}
