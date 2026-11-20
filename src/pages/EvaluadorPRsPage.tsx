import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Maximize2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import {
  clearGitHubCache,
  githubConfig,
  isGitHubConfigured,
  listOpenPullRequests,
  listPullRequestFiles,
  validarGuardianDeRutas,
} from '../lib/github';
import type { GitHubPullRequest } from '../types/github';

const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

export function EvaluadorPRsPage() {
  const queryClient = useQueryClient();
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(null);

  function handleRefreshPRs() {
    clearGitHubCache('pr');
    void queryClient.invalidateQueries({ queryKey: ['github', 'prs'] });
    void queryClient.invalidateQueries({ queryKey: ['github', 'pr-files'] });
  }

  const repoPullsUrl = isGitHubConfigured
    ? `https://github.com/${githubConfig.owner}/${githubConfig.repo}/pulls`
    : null;

  const prsQuery = useQuery({
    queryKey: ['github', 'prs', 'open'],
    queryFn: listOpenPullRequests,
    enabled: isGitHubConfigured,
  });

  const selectedPR: GitHubPullRequest | null = useMemo(
    () => (prsQuery.data ?? []).find((pr) => pr.number === selectedPRNumber) ?? null,
    [prsQuery.data, selectedPRNumber],
  );

  const filesQuery = useQuery({
    queryKey: ['github', 'pr-files', selectedPR?.number],
    queryFn: () => listPullRequestFiles(selectedPR!.number),
    enabled: isGitHubConfigured && Boolean(selectedPR),
  });

  const allFiles = filesQuery.data ?? [];
  const guardian =
    selectedPR && filesQuery.data
      ? validarGuardianDeRutas(selectedPR.user.login, filesQuery.data)
      : null;

  const stats = useMemo(() => {
    let add = 0;
    let del = 0;
    const junk: string[] = [];
    for (const f of allFiles) {
      add += f.additions;
      del += f.deletions;
      const lower = f.filename.toLowerCase();
      const base = lower.split('/').pop() ?? '';
      if (
        lower.includes('/node_modules/') ||
        lower.startsWith('node_modules/') ||
        ((base === '.env' || base.startsWith('.env.')) && base !== '.env.example')
      ) {
        junk.push(f.filename);
      }
    }
    return { add, del, junk };
  }, [allFiles]);

  const codeFiles = useMemo(
    () =>
      allFiles.filter((f) => {
        const base = f.filename.split('/').pop() ?? '';
        return !IGNORED_FILES.has(base);
      }),
    [allFiles],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Lista de PRs */}
      <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Pull Requests Abiertos
          </h1>
          <div className="flex items-center gap-1.5">
            {prsQuery.data && <Badge variant="neutral">{prsQuery.data.length}</Badge>}
            {isGitHubConfigured && (
              <button
                type="button"
                onClick={handleRefreshPRs}
                title="Actualizar Pull Requests desde GitHub"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${prsQuery.isFetching ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {!isGitHubConfigured && (
          <p className="text-xs text-[var(--text-secondary)]">
            Configurá <code>VITE_GITHUB_OWNER</code> y <code>VITE_GITHUB_REPO</code> en{' '}
            <code>.env</code>.
          </p>
        )}

        {prsQuery.isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Spinner label="Buscando Pull Requests..." className="pt-1" />
          </div>
        )}

        {prsQuery.isError && (
          <div className="space-y-2.5 rounded-lg border border-[var(--status-err-fg)]/30 bg-[var(--status-err-bg)] p-3 text-xs text-[var(--status-err-fg)]">
            <p className="font-medium">{(prsQuery.error as Error).message}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleRefreshPRs}>
                <RefreshCw className="h-3 w-3" />
                Reintentar
              </Button>
              {repoPullsUrl && (
                <a href={repoPullsUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    Ver en GitHub <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}

        {prsQuery.data?.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            No hay Pull Requests abiertos en este momento.
          </p>
        )}

        <ul className="space-y-2">
          {prsQuery.data?.map((pr) => {
            const active = selectedPR?.number === pr.number;
            return (
              <li key={pr.number}>
                <button
                  type="button"
                  onClick={() => setSelectedPRNumber(pr.number)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                    active
                      ? 'border-[var(--text-primary)] bg-[var(--bg-canvas)]'
                      : 'border-[var(--border)] bg-[var(--bg-canvas)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <img
                    src={pr.user.avatar_url}
                    alt={pr.user.login}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full border border-[var(--border)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      #{pr.number} {pr.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      @{pr.user.login} · {new Date(pr.updated_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Resumen ejecutivo del PR seleccionado */}
      <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 lg:col-span-8">
        {!selectedPR ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <FileCode2 className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
              Seleccioná un Pull Request para auditarlo
            </p>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
              Vas a ver el estado del Guardián de Rutas, la declaración honesta de IA y el acceso al
              visor de diff en pantalla completa.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedPR.user.avatar_url}
                  alt={selectedPR.user.login}
                  className="h-9 w-9 rounded-full border border-[var(--border)]"
                />
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    #{selectedPR.number} — {selectedPR.title}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Autor: <span className="font-mono">@{selectedPR.user.login}</span> ·{' '}
                    {allFiles.length} archivo(s) ·{' '}
                    <span className="font-mono text-[var(--status-ok-fg)]">+{stats.add}</span> /{' '}
                    <span className="font-mono text-[var(--status-err-fg)]">-{stats.del}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/evaluador/${selectedPR.number}/diff`}>
                  <Button variant="primary" size="sm">
                    <Maximize2 className="h-3.5 w-3.5" />
                    Ver diff completo
                  </Button>
                </Link>
                <a href={selectedPR.html_url} target="_blank" rel="noreferrer">
                  <Button variant="secondary" size="sm">
                    GitHub <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>

            {guardian && (
              <div className="flex flex-wrap items-center gap-2">
                {guardian.permitido ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Guardián OK: solo tocó {guardian.prefijoEsperado}
                  </Badge>
                ) : (
                  <Badge variant="error">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    BLOQUEADO — fuera de {guardian.prefijoEsperado}:{' '}
                    {guardian.archivosProhibidos.join(', ')}
                  </Badge>
                )}

                {stats.junk.length > 0 && (
                  <Badge variant="error">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Detectados node_modules / .env: {stats.junk.length}
                  </Badge>
                )}
              </div>
            )}

            {selectedPR.body && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Descripción y Declaración de IA
                </h3>
                <div className="campus-prose text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedPR.body}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Resumen compacto de archivos tocados */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Archivos modificados ({codeFiles.length})
                </h3>
                <Link
                  to={`/evaluador/${selectedPR.number}/diff`}
                  className="text-xs font-medium text-[var(--text-primary)] underline underline-offset-2"
                >
                  Explorar diff completo →
                </Link>
              </div>

              {filesQuery.isLoading ? (
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              ) : filesQuery.isError ? (
                <p className="text-xs text-[var(--status-err-fg)]">
                  {(filesQuery.error as Error).message}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] font-mono text-xs">
                  {codeFiles.map((f) => (
                    <li key={f.filename} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate text-[var(--text-primary)]">{f.filename}</span>
                      <span className="shrink-0 text-[11px]">
                        <span className="text-[var(--status-ok-fg)]">+{f.additions}</span>{' '}
                        <span className="text-[var(--status-err-fg)]">-{f.deletions}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
