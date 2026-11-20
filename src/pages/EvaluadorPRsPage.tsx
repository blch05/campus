import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCode2,
  Maximize2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import { formatAppError, parseAppError } from '../lib/errors';
import {
  clearGitHubCache,
  githubConfig,
  isGitHubConfigured,
  listOpenPullRequests,
  listPullRequestFiles,
  validarGuardianDeRutas,
} from '../lib/github';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Alumno, Clase, EstadoEntrega } from '../types/database';
import type { GitHubPullRequest, GitHubPullRequestFile } from '../types/github';

const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);

function inferClaseNumeroFromFiles(files: GitHubPullRequestFile[]): number {
  for (const f of files) {
    const lower = f.filename.toLowerCase();
    if (/^entregas\/[^/]+\/clase-0?0\//.test(lower)) return 0;
    const semMatch = lower.match(/^entregas\/[^/]+\/semana-0?(\d+)\//);
    if (semMatch) {
      const n = Number(semMatch[1]);
      if (n >= 1 && n <= 12) return n;
    }
    const exMatch = lower.match(/^entregas\/[^/]+\/examen-0?(\d+)\//);
    if (exMatch) {
      const hito = Number(exMatch[1]);
      if (hito === 1) return 4;
      if (hito === 2) return 8;
      if (hito === 3) return 12;
    }
  }
  return 0;
}

export function EvaluadorPRsPage() {
  const queryClient = useQueryClient();
  const [selectedPRNumber, setSelectedPRNumber] = useState<number | null>(null);

  // Registro rápido en Libreta desde el PR
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [regAlumnoId, setRegAlumnoId] = useState('');
  const [regClaseNum, setRegClaseNum] = useState<number>(0);
  const [regEstado, setRegEstado] = useState<EstadoEntrega>('aprobada');
  const [regObs, setRegObs] = useState('');
  const [regFeedback, setRegFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(
    null,
  );

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

  const alumnosQuery = useQuery({
    queryKey: ['supabase', 'alumnos'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('alumnos')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Alumno[];
    },
  });

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
  const alumnos = alumnosQuery.data ?? [];

  const upsertEntregaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPR || !regAlumnoId) throw new Error('Seleccioná un estudiante.');
      const { error } = await supabase!.from('entregas').upsert(
        {
          alumno_id: regAlumnoId,
          clase_numero: regClaseNum,
          pr_number: selectedPR.number,
          estado: regEstado,
          observacion: regObs.trim() || null,
        },
        { onConflict: 'alumno_id,clase_numero' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setShowRegistrar(false);
      setRegObs('');
      setRegFeedback({
        type: 'ok',
        text: `Entrega del PR #${selectedPR?.number} guardada en Libreta (${regEstado}).`,
      });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'entregas'] });
    },
    onError: (err) => {
      setRegFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    },
  });

  function openRegistrarPanel() {
    if (!selectedPR) return;
    setRegFeedback(null);
    const login = selectedPR.user.login.toLowerCase();
    const matched = alumnos.find((a) => a.github_username.toLowerCase() === login);
    setRegAlumnoId(matched?.id ?? '');
    setRegClaseNum(inferClaseNumeroFromFiles(allFiles));
    setRegEstado('aprobada');
    setRegObs('');
    setShowRegistrar(true);
  }

  function handleRegistrarSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!regAlumnoId) return;
    setRegFeedback(null);
    upsertEntregaMutation.mutate();
  }
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
                  onClick={() => {
                    setSelectedPRNumber(pr.number);
                    setShowRegistrar(false);
                    setRegFeedback(null);
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

              <div className="flex flex-wrap items-center gap-2">
                {isSupabaseConfigured && (
                  <Button variant="secondary" size="sm" onClick={openRegistrarPanel}>
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Registrar en Libreta
                  </Button>
                )}
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

            {regFeedback && (
              <div
                role={regFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                  regFeedback.type === 'error'
                    ? 'border-[var(--status-err-border)] bg-[var(--status-err-bg)] text-[var(--status-err-fg)]'
                    : 'border-[var(--status-ok-border)] bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)]'
                }`}
              >
                {regFeedback.text}
              </div>
            )}

            {showRegistrar && isSupabaseConfigured && (
              <form
                onSubmit={handleRegistrarSubmit}
                className="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-canvas)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Registrar PR #{selectedPR.number} en Libreta
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRegistrar(false)}
                    aria-label="Cerrar panel de registro"
                    className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <select
                    required
                    value={regAlumnoId}
                    onChange={(e) => setRegAlumnoId(e.target.value)}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {alumnos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} (@{a.github_username})
                      </option>
                    ))}
                  </select>

                  <select
                    value={regClaseNum}
                    onChange={(e) => setRegClaseNum(Number(e.target.value))}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    {(clasesQuery.data ?? []).map((c) => (
                      <option key={c.numero} value={c.numero}>
                        {c.numero === 0 ? 'Clase 0' : `Semana ${c.numero}`}
                      </option>
                    ))}
                  </select>

                  <select
                    value={regEstado}
                    onChange={(e) => setRegEstado(e.target.value as EstadoEntrega)}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="aprobada">Aprobada</option>
                    <option value="en_revision">En revisión</option>
                    <option value="prorroga">Prórroga</option>
                    <option value="desaprobada">Desaprobada</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={300}
                    placeholder="Observación / devolución opcional (máx. 300 caracteres)..."
                    value={regObs}
                    onChange={(e) => setRegObs(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={upsertEntregaMutation.isPending || !regAlumnoId}
                  >
                    {upsertEntregaMutation.isPending ? 'Guardando...' : 'Guardar entrega'}
                  </Button>
                </div>
              </form>
            )}

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
