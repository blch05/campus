import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchMarkdownFile, isGitHubConfigured, listRepoPath } from '../lib/github';

export function ClasesPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const clasesQuery = useQuery({
    queryKey: ['github', 'clases'],
    queryFn: () => listRepoPath('clases'),
    enabled: isGitHubConfigured,
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
                  onClick={() => setSelectedPath(doc.path)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Clases</h2>
          <ul className="mt-2 space-y-1">
            {clasesQuery.data?.map((dir) => (
              <li key={dir.path}>
                <button
                  type="button"
                  onClick={() => setSelectedPath(`${dir.path}/consigna.md`)}
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
        {!selectedPath ? (
          <p className="text-sm text-slate-400">
            Seleccioná un documento o una semana del menú lateral para leer su consigna.
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
