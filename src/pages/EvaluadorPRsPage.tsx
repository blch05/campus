import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  isGitHubConfigured,
  listOpenPullRequests,
  listPullRequestFiles,
  validarGuardianDeRutas,
} from '../lib/github';
import type { GitHubPullRequest } from '../types/github';

const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

export function EvaluadorPRsPage() {
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);

  const prsQuery = useQuery({
    queryKey: ['github', 'prs', 'open'],
    queryFn: listOpenPullRequests,
    enabled: isGitHubConfigured,
  });

  const filesQuery = useQuery({
    queryKey: ['github', 'pr-files', selectedPR?.number],
    queryFn: () => listPullRequestFiles(selectedPR!.number),
    enabled: isGitHubConfigured && Boolean(selectedPR),
  });

  const guardian =
    selectedPR && filesQuery.data
      ? validarGuardianDeRutas(selectedPR.user.login, filesQuery.data)
      : null;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h1 className="text-lg font-semibold text-white">PRs Abiertos</h1>
        {prsQuery.isLoading && <p className="text-sm text-slate-400">Buscando PRs...</p>}
        {prsQuery.data?.length === 0 && (
          <p className="text-sm text-slate-400">No hay Pull Requests abiertos.</p>
        )}
        <ul className="space-y-2">
          {prsQuery.data?.map((pr) => (
            <li key={pr.number}>
              <button
                type="button"
                onClick={() => setSelectedPR(pr)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedPR?.number === pr.number
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <p className="text-sm font-medium text-white">
                  #{pr.number} {pr.title}
                </p>
                <p className="mt-1 text-xs text-slate-400">@{pr.user.login}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 md:col-span-2">
        {!selectedPR ? (
          <p className="text-sm text-slate-400">
            Seleccioná un Pull Request para auditar el Guardián de Rutas, la declaración de IA y el
            diff de código.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white">
                  #{selectedPR.number} — {selectedPR.title}
                </h2>
                <p className="text-xs text-slate-400">Autor: @{selectedPR.user.login}</p>
              </div>
              <a
                href={selectedPR.html_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Abrir en GitHub
              </a>
            </div>

            {guardian && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  guardian.permitido
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                }`}
              >
                {guardian.permitido
                  ? `Guardián de Rutas OK: todos los archivos están en ${guardian.prefijoEsperado}`
                  : `Guardián BLOQUEADO — archivos fuera de ${guardian.prefijoEsperado}: ${guardian.archivosProhibidos.join(', ')}`}
              </div>
            )}

            {selectedPR.body && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="text-xs font-semibold uppercase text-slate-400">
                  Descripción y Declaración de IA
                </h3>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-200">
                  {selectedPR.body}
                </pre>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-slate-400">
                Diff limpio de código modificado
              </h3>
              {filesQuery.data
                ?.filter((f) => !IGNORED_FILES.has(f.filename.split('/').pop() ?? '') && f.patch)
                .map((file) => (
                  <details
                    key={file.filename}
                    open
                    className="rounded-lg border border-slate-800 bg-slate-950"
                  >
                    <summary className="cursor-pointer px-3 py-2 text-xs font-mono text-slate-200">
                      {file.filename} (+{file.additions} / -{file.deletions})
                    </summary>
                    <pre className="overflow-x-auto border-t border-slate-800 p-3 text-xs text-slate-300">
                      {file.patch}
                    </pre>
                  </details>
                ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
