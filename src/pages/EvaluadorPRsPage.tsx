import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, FileCode2, ShieldAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

function renderDiffLines(patch: string) {
  return patch.split('\n').map((line, idx) => {
    let rowClass = 'text-[var(--text-secondary)]';
    if (line.startsWith('@@')) {
      rowClass = 'bg-[var(--bg-hover)] text-[var(--text-muted)] font-semibold';
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      rowClass = 'bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)]';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      rowClass = 'bg-[var(--status-err-bg)] text-[var(--status-err-fg)]';
    }

    return (
      <div key={idx} className={`whitespace-pre px-3 py-0.5 font-mono text-xs leading-5 ${rowClass}`}>
        {line || ' '}
      </div>
    );
  });
}

export function EvaluadorPRsPage() {
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);
  const [fileFilter, setFileFilter] = useState('');
  const [expandAll, setExpandAll] = useState(true);

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

  const codeFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    return allFiles.filter((f) => {
      const base = f.filename.split('/').pop() ?? '';
      if (IGNORED_FILES.has(base) || !f.patch) return false;
      if (q && !f.filename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allFiles, fileFilter]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Lista de PRs */}
      <aside className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 lg:col-span-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Pull Requests Abiertos
          </h1>
          {prsQuery.data && <Badge variant="neutral">{prsQuery.data.length}</Badge>}
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
                  onClick={() => {
                    setSelectedPR(pr);
                    setFileFilter('');
                  }}
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

      {/* Auditoría del PR seleccionado */}
      <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 lg:col-span-8">
        {!selectedPR ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <FileCode2 className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
              Seleccioná un Pull Request para auditarlo
            </p>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
              Vas a ver el estado del Guardián de Rutas, la declaración honesta de IA y el diff
              coloreado solo del código modificado.
            </p>
          </div>
        ) : (
          <>
            {/* Cabecera del PR */}
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

              <a href={selectedPR.html_url} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  Abrir en GitHub <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>

            {/* Guardián de Rutas + archivos prohibidos */}
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

            {/* Descripción + Declaración de IA en Markdown */}
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

            {/* Controles del diff */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Diff limpio ({codeFiles.length} archivo(s))
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filtrar archivo..."
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                  />
                  <Button variant="secondary" size="sm" onClick={() => setExpandAll((p) => !p)}>
                    {expandAll ? 'Colapsar todos' : 'Expandir todos'}
                  </Button>
                </div>
              </div>

              {filesQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Spinner label="Cargando archivos modificados..." />
                </div>
              ) : (
                codeFiles.map((file) => (
                  <details
                    key={`${file.filename}-${expandAll}`}
                    open={expandAll}
                    className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)]"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 bg-[var(--bg-surface)] px-3 py-2 text-xs">
                      <span className="truncate font-mono font-medium text-[var(--text-primary)]">
                        {file.filename}
                      </span>
                      <span className="shrink-0 font-mono text-[11px]">
                        <span className="text-[var(--status-ok-fg)]">+{file.additions}</span>{' '}
                        <span className="text-[var(--status-err-fg)]">-{file.deletions}</span>
                      </span>
                    </summary>
                    <div className="overflow-x-auto border-t border-[var(--border)] py-1">
                      {renderDiffLines(file.patch!)}
                    </div>
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
