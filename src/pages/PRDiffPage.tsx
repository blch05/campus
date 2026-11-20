import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import {
  getPullRequest,
  isGitHubConfigured,
  listPullRequestFiles,
  validarGuardianDeRutas,
} from '../lib/github';
import type { GitHubPullRequestFile } from '../types/github';

const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const SIDEBAR_KEY = 'campus-diff-sidebar-collapsed';

interface TreeNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
  file?: GitHubPullRequestFile;
}

function buildFileTree(files: GitHubPullRequestFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;
    let accPath = '';

    parts.forEach((part, idx) => {
      accPath = accPath ? `${accPath}/${part}` : part;
      const isFile = idx === parts.length - 1;

      let node = current.find((n) => n.name === part && n.type === (isFile ? 'file' : 'dir'));
      if (!node) {
        node = isFile
          ? { name: part, path: accPath, type: 'file', file }
          : { name: part, path: accPath, type: 'dir', children: [] };
        current.push(node);
      }
      if (!isFile && node.children) {
        current = node.children;
      }
    });
  }

  function sortNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => (n.children ? { ...n, children: sortNodes(n.children) } : n));
  }

  return sortNodes(root);
}

function DiffViewer({ patch }: { patch?: string }) {
  if (!patch) {
    return (
      <p className="p-4 text-xs text-[var(--text-muted)]">
        Archivo binario, vacío o sin diff textual disponible.
      </p>
    );
  }

  const lines = patch.split('\n');
  let oldLine = 0;
  let newLine = 0;

  return (
    <div className="overflow-x-auto font-mono text-xs leading-5">
      {lines.map((line, idx) => {
        const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          oldLine = Number(hunkMatch[1]);
          newLine = Number(hunkMatch[2]);
          return (
            <div
              key={idx}
              className="flex bg-[var(--bg-hover)] px-3 py-1 font-semibold text-[var(--text-muted)]"
            >
              <span className="w-16 shrink-0 select-none text-right pr-3">...</span>
              <span className="whitespace-pre">{line}</span>
            </div>
          );
        }

        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isDel = line.startsWith('-') && !line.startsWith('---');

        let oldNum = '';
        let newNum = '';
        if (isAdd) {
          newNum = String(newLine++);
        } else if (isDel) {
          oldNum = String(oldLine++);
        } else {
          oldNum = String(oldLine++);
          newNum = String(newLine++);
        }

        const rowClass = isAdd
          ? 'bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)]'
          : isDel
            ? 'bg-[var(--status-err-bg)] text-[var(--status-err-fg)]'
            : 'text-[var(--text-secondary)]';

        return (
          <div key={idx} className={`flex px-3 py-0.5 ${rowClass}`}>
            <span className="w-8 shrink-0 select-none pr-2 text-right opacity-55">{oldNum}</span>
            <span className="w-8 shrink-0 select-none pr-3 text-right opacity-55">{newNum}</span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PRDiffPage() {
  const { prNumber } = useParams<{ prNumber: string }>();
  const num = Number(prNumber);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === 'true';
  });
  const [closedDirs, setClosedDirs] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const prQuery = useQuery({
    queryKey: ['github', 'pr', num],
    queryFn: () => getPullRequest(num),
    enabled: isGitHubConfigured && Number.isFinite(num) && num > 0,
  });

  const filesQuery = useQuery({
    queryKey: ['github', 'pr-files', num],
    queryFn: () => listPullRequestFiles(num),
    enabled: isGitHubConfigured && Number.isFinite(num) && num > 0,
  });

  const codeFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (filesQuery.data ?? []).filter((f) => {
      const base = f.filename.split('/').pop() ?? '';
      if (IGNORED_FILES.has(base)) return false;
      if (q && !f.filename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filesQuery.data, filter]);

  const activeFilename = selectedFile ?? codeFiles[0]?.filename ?? null;
  const activeFileObj = codeFiles.find((f) => f.filename === activeFilename) ?? null;

  const tree = useMemo(() => buildFileTree(codeFiles), [codeFiles]);

  const guardian =
    prQuery.data && filesQuery.data
      ? validarGuardianDeRutas(prQuery.data.user.login, filesQuery.data)
      : null;

  function toggleDir(path: string) {
    setClosedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  function renderTree(nodes: TreeNode[], depth = 0) {
    return (
      <ul className="space-y-0.5">
        {nodes.map((node) => {
          const padLeft = `${depth * 12 + 8}px`;
          if (node.type === 'dir') {
            const isClosed = Boolean(closedDirs[node.path]);
            return (
              <li key={node.path}>
                <button
                  type="button"
                  onClick={() => toggleDir(node.path)}
                  style={{ paddingLeft: padLeft }}
                  className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  {isClosed ? (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <Folder className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{node.name}</span>
                </button>
                {!isClosed && node.children && renderTree(node.children, depth + 1)}
              </li>
            );
          }

          const active = viewMode === 'single' && activeFilename === node.path;
          const f = node.file!;
          return (
            <li key={node.path}>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(node.path);
                  setViewMode('single');
                }}
                style={{ paddingLeft: padLeft }}
                title={node.path}
                className={`flex w-full items-center justify-between gap-2 rounded-md py-1.5 pr-2 text-left text-xs transition ${
                  active
                    ? 'bg-[var(--bg-hover)] font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate font-mono">{node.name}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px]">
                  <span className="text-[var(--status-ok-fg)]">+{f.additions}</span>{' '}
                  <span className="text-[var(--status-err-fg)]">-{f.deletions}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full">
      {/* Sidebar colapsable con árbol de archivos (reciclando el patrón de Clases) */}
      <aside
        aria-label="Estructura de archivos del PR"
        className={`shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-12' : 'w-72'
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expandir árbol de archivos"
              aria-label="Expandir árbol de archivos"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <div className="my-1 h-px w-6 bg-[var(--border)]" />
            <div className="flex flex-col items-center gap-1">
              {codeFiles.map((f, idx) => {
                const active = viewMode === 'single' && activeFilename === f.filename;
                return (
                  <button
                    key={f.filename}
                    type="button"
                    title={f.filename}
                    onClick={() => {
                      setSelectedFile(f.filename);
                      setViewMode('single');
                    }}
                    className={`flex h-7 w-8 items-center justify-center rounded-md font-mono text-xs transition ${
                      active
                        ? 'bg-[var(--cta-bg)] font-semibold text-[var(--cta-fg)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col p-3">
            <div className="mb-3 flex items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Archivos ({codeFiles.length})
              </span>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Achicar panel de archivos"
                aria-label="Achicar panel de archivos"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar archivo..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mb-3 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
            />

            <div className="flex-1 overflow-y-auto">
              {filesQuery.isLoading ? (
                <div className="space-y-2 px-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                  <Skeleton className="h-6 w-4/5" />
                </div>
              ) : (
                renderTree(tree)
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Zona principal full-screen de Diff */}
      <section className="min-w-0 flex-1 bg-[var(--bg-canvas)]">
        {/* Barra contextual del PR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)] px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/evaluador">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">
                {prQuery.data ? `#${prQuery.data.number} — ${prQuery.data.title}` : `PR #${num}`}
              </h1>
              {prQuery.data && (
                <p className="text-xs text-[var(--text-secondary)]">
                  @{prQuery.data.user.login} · {codeFiles.length} archivo(s) de código
                </p>
              )}
            </div>
            {guardian && (
              <Badge variant={guardian.permitido ? 'success' : 'error'}>
                {guardian.permitido ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Guardián OK
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3" /> Bloqueado
                  </>
                )}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`rounded px-2.5 py-1 font-medium ${
                  viewMode === 'single'
                    ? 'bg-[var(--cta-bg)] text-[var(--cta-fg)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Por archivo
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded px-2.5 py-1 font-medium ${
                  viewMode === 'all'
                    ? 'bg-[var(--cta-bg)] text-[var(--cta-fg)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Ver todos
              </button>
            </div>

            {prQuery.data && (
              <a href={prQuery.data.html_url} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  GitHub <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Contenido del diff */}
        <div className="p-6 space-y-6">
          {filesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-64 w-full" />
              <Spinner label="Cargando diff completo..." />
            </div>
          ) : filesQuery.isError ? (
            <div className="rounded-lg border border-[var(--status-err-fg)]/30 bg-[var(--status-err-bg)] p-4 text-sm text-[var(--status-err-fg)]">
              {(filesQuery.error as Error).message}
            </div>
          ) : viewMode === 'single' ? (
            activeFileObj ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs">
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {activeFileObj.filename}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant="neutral">{activeFileObj.status}</Badge>
                    <span className="text-[var(--status-ok-fg)]">+{activeFileObj.additions}</span>
                    <span className="text-[var(--status-err-fg)]">-{activeFileObj.deletions}</span>
                  </div>
                </div>
                <DiffViewer patch={activeFileObj.patch} />
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                No hay archivos de código para mostrar.
              </p>
            )
          ) : (
            codeFiles.map((f) => (
              <div
                key={f.filename}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-canvas)]"
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs">
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {f.filename}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant="neutral">{f.status}</Badge>
                    <span className="text-[var(--status-ok-fg)]">+{f.additions}</span>
                    <span className="text-[var(--status-err-fg)]">-{f.deletions}</span>
                  </div>
                </div>
                <DiffViewer patch={f.patch} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
