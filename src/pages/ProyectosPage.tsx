import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
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
        <h1 className="text-2xl font-bold text-white">Galería de MVPs de la Cohorte</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alimentada por la vista segura <code>public.proyectos_cohorte</code> en Supabase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectosQuery.data?.map((proyecto) => (
          <div
            key={proyecto.github_username}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <h2 className="text-lg font-semibold text-white">
              {proyecto.mvp_titulo ?? 'Proyecto Integrador'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {proyecto.nombre} (@{proyecto.github_username})
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              {proyecto.mvp_url && (
                <a
                  href={proyecto.mvp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
                >
                  Ver App <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {proyecto.mvp_repo_url && (
                <a
                  href={proyecto.mvp_repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-slate-300 hover:underline"
                >
                  Repositorio <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {(!proyectosQuery.data || proyectosQuery.data.length === 0) && (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-sm text-slate-400 sm:col-span-2 lg:col-span-3">
            Todavía no hay MVPs publicados. En la Semana 11 los alumnos emancipan su proyecto a su
            propio repositorio y lo despliegan en Vercel + Render.
          </div>
        )}
      </div>
    </div>
  );
}
