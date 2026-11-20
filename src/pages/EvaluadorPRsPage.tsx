import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
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
      <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          PRs Abiertos
        </h1>
        {!isGitHubConfigured && (
          <p className="text-xs text-[var(--text-secondary)]">
            Configurá <code>VITE_GITHUB_OWNER</code> y <code>VITE_GITHUB_REPO</code> en{' '}
            <code>.env</code>.
          </p>
        )}
        {prsQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Spinner label="Buscando Pull Requests..." className="pt-1" />
          </div>
        )}
        {prsQuery.data?.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">No hay Pull Requests abiertos.</p>
        )}
        <ul className="space-y-2">
          {prsQuery.data?.map((pr) => (
            <li key={pr.number}>
              <button
                type="button"
                onClick={() => setSelectedPR(pr)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  selectedPR?.number === pr.number
                    ? 'border-[var(--text-primary)] bg-[var(--bg-canvas)]'
                    : 'border-[var(--border)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]'
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  #{pr.number} {pr.title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">@{pr.user.login}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 md:col-span-2">
        {!selectedPR ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Seleccioná un Pull Request para auditar el Guardián de Rutas, la declaración de IA y el
            diff limpio de código.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  #{selectedPR.number} — {selectedPR.title}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Autor: @{selectedPR.user.login}
                </p>
              </div>
              <a href={selectedPR.html_url} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  Abrir en GitHub <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>

            {guardian && (
              <div>
                {guardian.permitido ? (
                  <Badge variant="success">
                    Guardián OK: todos los archivos están en {guardian.prefijoEsperado}
                  </Badge>
                ) : (
                  <Badge variant="error">
                    BLOQUEADO — fuera de {guardian.prefijoEsperado}:{' '}
                    {guardian.archivosProhibidos.join(', ')}
                  </Badge>
                )}
              </div>
            )}

            {selectedPR.body && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Descripción y Declaración de IA
                </h3>
                <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">
                  {selectedPR.body}
                </pre>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Diff limpio de código modificado
              </h3>
              {filesQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Spinner label="Cargando archivos modificados..." />
                </div>
              ) : (
                filesQuery.data
                  ?.filter((f) => !IGNORED_FILES.has(f.filename.split('/').pop() ?? '') && f.patch)
                  .map((file) => (
                    <details
                      key={file.filename}
                      open
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)]"
                    >
                      <summary className="cursor-pointer px-3 py-2 font-mono text-xs text-[var(--text-primary)]">
                        {file.filename} (+{file.additions} / -{file.deletions})
                      </summary>
                      <pre className="overflow-x-auto border-t border-[var(--border)] p-3 text-xs text-[var(--text-secondary)]">
                        {file.patch}
                      </pre>
                    </details>
                  ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
