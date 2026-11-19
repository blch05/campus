import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Lock, Unlock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchMarkdownFile, githubConfig, isGitHubConfigured, listRepoPath } from '../lib/github';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import type { Clase } from '../types/database';

export function ClasesPage() {
  const queryClient = useQueryClient();
  const esStaff = useAuthStore((s) => s.esStaff)();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [lockedSelected, setLockedSelected] = useState<Clase | null>(null);

  const clasesDbQuery = useQuery({
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

  const clasesRepoQuery = useQuery({
    queryKey: ['github', 'clases'],
    queryFn: () => listRepoPath('clases'),
    enabled: isGitHubConfigured && !isSupabaseConfigured,
  });

  const docsQuery = useQuery({
    queryKey: ['github', 'docs'],
    queryFn: () => listRepoPath('docs'),
    enabled: isGitHubConfigured,
  });

  const markdownQuery = useQuery({
    queryKey: ['github', 'markdown', selectedPath],
    queryFn: () => fetchMarkdownFile(selectedPath!),
    enabled: isGitHubConfigured && Boolean(selectedPath),
  });

  const toggleDesbloqueoMutation = useMutation({
    mutationFn: async ({ id, desbloqueada }: { id: number; desbloqueada: boolean }) => {
      const { error } = await supabase!
        .from('clases')
        .update({ desbloqueada })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'clases'] });
    },
  });

  const repoUrl = isGitHubConfigured
    ? `https://github.com/${githubConfig.owner}/${githubConfig.repo}`
    : null;

  function handleSelectClase(clase: Clase) {
    if (!clase.desbloqueada && !esStaff) {
      setSelectedPath(null);
      setLockedSelected(clase);
      return;
    }
    setLockedSelected(null);
    setSelectedPath(`${clase.carpeta_repo}/consigna.md`);
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <aside className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Documentación
          </h2>
          <ul className="mt-2 space-y-1">
            {docsQuery.data?.map((doc) => (
              <li key={doc.path}>
                <button
                  type="button"
                  onClick={() => {
                    setLockedSelected(null);
                    setSelectedPath(doc.path);
                  }}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                    selectedPath === doc.path
                      ? 'bg-indigo-600/20 text-indigo-300'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {doc.name}
                </button>
              </li>
            ))}
            {!isGitHubConfigured && (
              <li className="text-xs text-slate-500">Conectá GitHub en .env para listar docs/</li>
            )}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Clases
            </h2>
            {esStaff && isSupabaseConfigured && (
              <span className="text-[11px] text-indigo-400">Control docente</span>
            )}
          </div>

          <ul className="mt-2 space-y-1.5">
            {isSupabaseConfigured
              ? clasesDbQuery.data?.map((clase) => {
                  const bloqueada = !clase.desbloqueada;
                  const active = selectedPath === `${clase.carpeta_repo}/consigna.md`;
                  return (
                    <li key={clase.id} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectClase(clase)}
                        className={`flex flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                          active
                            ? 'bg-indigo-600/20 text-indigo-300'
                            : bloqueada && !esStaff
                              ? 'text-slate-500 hover:bg-slate-800/50'
                              : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">
                          {clase.numero === 0 ? 'Clase 0' : `Semana ${clase.numero}`}
                        </span>
                        {bloqueada ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                      </button>

                      {esStaff && (
                        <button
                          type="button"
                          disabled={toggleDesbloqueoMutation.isPending}
                          onClick={() =>
                            toggleDesbloqueoMutation.mutate({
                              id: clase.id,
                              desbloqueada: !clase.desbloqueada,
                            })
                          }
                          title={bloqueada ? 'Desbloquear para alumnos' : 'Bloquear para alumnos'}
                          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {bloqueada ? 'Abrir' : 'Cerrar'}
                        </button>
                      )}
                    </li>
                  );
                })
              : clasesRepoQuery.data?.map((dir) => (
                  <li key={dir.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setLockedSelected(null);
                        setSelectedPath(`${dir.path}/consigna.md`);
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                    >
                      {dir.name}
                    </button>
                  </li>
                ))}
          </ul>
        </div>
      </aside>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 md:col-span-2">
        {lockedSelected ? (
          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-6">
            <div className="flex items-center gap-2 text-amber-300">
              <Lock className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-white">{lockedSelected.titulo}</h2>
            </div>
            <p className="text-sm text-slate-300">
              Esta clase todavía está bloqueada en el Campus y se habilitará cuando lleguemos a esa
              semana.
            </p>
            <p className="text-sm text-slate-400">
              ¿Querés adelantar por tu cuenta? Podés investigar el material directamente en el
              repositorio del curso en GitHub.
            </p>
            {repoUrl && (
              <a
                href={`${repoUrl}/tree/main/${lockedSelected.carpeta_repo}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-indigo-300 hover:bg-slate-700"
              >
                Explorar en GitHub <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : !selectedPath ? (
          <p className="text-sm text-slate-400">
            Seleccioná un documento o una clase desbloqueada del menú lateral para leer su consigna.
          </p>
        ) : markdownQuery.isLoading ? (
          <p className="text-sm text-slate-400">Cargando contenido desde GitHub...</p>
        ) : markdownQuery.isError ? (
          <p className="text-sm text-rose-400">{(markdownQuery.error as Error).message}</p>
        ) : (
          <article className="space-y-4 text-sm leading-relaxed text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownQuery.data ?? ''}</ReactMarkdown>
          </article>
        )}
      </section>
    </div>
  );
}
