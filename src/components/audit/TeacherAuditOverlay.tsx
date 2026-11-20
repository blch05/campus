import { useEffect, useState } from 'react';
import { Database, Play, Terminal, X } from 'lucide-react';
import { fetchMarkdownFile, isGitHubConfigured } from '../../lib/github';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type AuditTab = 'endpoints' | 'schema';

interface ProbeResult {
  caso: string;
  esperado: string;
  status: number | 'ERROR';
  ms: number;
  ok: boolean;
  preview: string;
}

interface ParsedTable {
  name: string;
  columns: string[];
  foreignKeys: string[];
}

function parseSqlSchema(sql: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const regex = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    const tableName = match[1].replace(/"/g, '');
    const body = match[2];
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--'));

    const columns: string[] = [];
    const foreignKeys: string[] = [];

    for (const line of lines) {
      const refMatch = line.match(/references\s+([a-z0-9_."]+)\s*\(([^)]+)\)/i);
      const colName = line.split(/\s+/)[0].replace(/[,("]/g, '');
      if (!/^(constraint|primary|unique|check|foreign)/i.test(colName)) {
        columns.push(line.replace(/,$/, ''));
      }
      if (refMatch) {
        foreignKeys.push(`${colName} → ${refMatch[1]}(${refMatch[2]})`);
      }
    }

    tables.push({ name: tableName, columns, foreignKeys });
  }

  return tables;
}

export function TeacherAuditOverlay() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuditTab>('endpoints');

  // Tester de Endpoints
  const [baseUrl, setBaseUrl] = useState('');
  const [path, setPath] = useState('/api/resumen');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);

  // Inspector de schema.sql
  const [githubUser, setGithubUser] = useState('');
  const [sqlText, setSqlText] = useState('');
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [loadingSql, setLoadingSql] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function runProbes() {
    if (!baseUrl.trim()) return;
    setRunning(true);
    setResults([]);

    const target = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const probes: { caso: string; esperado: string; headers?: Record<string, string>; body?: string; okStatuses: number[] }[] = [
      {
        caso: 'Sin header Authorization',
        esperado: '401 Unauthorized',
        okStatuses: [401, 403],
      },
      {
        caso: 'Bearer Token inválido / falso',
        esperado: '401 Unauthorized',
        headers: { Authorization: 'Bearer token.invalido.wtdev' },
        okStatuses: [401, 403],
      },
    ];

    if (method === 'POST') {
      probes.push({
        caso: 'Payload vacío / malformado',
        esperado: '400 / 401',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        okStatuses: [400, 401, 403, 422],
      });
    }

    const out: ProbeResult[] = [];
    for (const p of probes) {
      const start = performance.now();
      try {
        const res = await fetch(target, {
          method,
          headers: p.headers,
          body: p.body,
        });
        const ms = Math.round(performance.now() - start);
        const text = (await res.text()).slice(0, 180);
        out.push({
          caso: p.caso,
          esperado: p.esperado,
          status: res.status,
          ms,
          ok: p.okStatuses.includes(res.status),
          preview: text || '(respuesta vacía)',
        });
      } catch (err) {
        const ms = Math.round(performance.now() - start);
        out.push({
          caso: p.caso,
          esperado: p.esperado,
          status: 'ERROR',
          ms,
          ok: false,
          preview: `${(err as Error).message} (verificá CORS o que el backend esté online)`,
        });
      }
    }

    setResults(out);
    setRunning(false);
  }

  async function loadStudentSchema() {
    if (!githubUser.trim() || !isGitHubConfigured) return;
    setLoadingSql(true);
    setSqlError(null);
    try {
      const content = await fetchMarkdownFile(
        `entregas/${githubUser.trim().toLowerCase()}/mvp/supabase/schema.sql`,
      );
      setSqlText(content);
    } catch (err) {
      setSqlError((err as Error).message);
    } finally {
      setLoadingSql(false);
    }
  }

  const parsedTables = parseSqlSchema(sqlText);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Abrir Overlay de Auditoría Docente (Ctrl+Shift+D)"
        className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
      >
        <Terminal className="h-3.5 w-3.5" />
        Audit · Ctrl+Shift+D
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-canvas)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--text-primary)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Overlay de Auditoría Docente
            </span>
            <Badge variant="neutral">Ctrl + Shift + D</Badge>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar overlay"
            className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-5 py-2 text-xs">
          <button
            type="button"
            onClick={() => setTab('endpoints')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
              tab === 'endpoints'
                ? 'bg-[var(--cta-bg)] text-[var(--cta-fg)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            Tester de Endpoints
          </button>
          <button
            type="button"
            onClick={() => setTab('schema')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
              tab === 'schema'
                ? 'bg-[var(--cta-bg)] text-[var(--cta-fg)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Arquitectura BD (schema.sql)
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'endpoints' ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-12">
                <input
                  type="url"
                  placeholder="https://mvp-alumno.onrender.com"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] sm:col-span-5"
                />
                <input
                  type="text"
                  placeholder="/api/resumen"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] sm:col-span-3"
                />
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)] sm:col-span-2"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
                <Button
                  size="sm"
                  disabled={running || !baseUrl.trim()}
                  onClick={() => void runProbes()}
                  className="sm:col-span-2"
                >
                  {running ? 'Probando...' : 'Probar'}
                </Button>
              </div>

              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.caso}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{r.caso}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-muted)]">{r.ms} ms</span>
                        <Badge variant={r.ok ? 'success' : 'error'}>
                          HTTP {r.status} {r.ok ? '· OK' : `· Esperado ${r.esperado}`}
                        </Badge>
                      </div>
                    </div>
                    <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-[var(--text-secondary)]">
                      {r.preview}
                    </pre>
                  </div>
                ))}
                {results.length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Dispará pruebas automáticas sin token, con JWT falso y payloads vacíos contra el
                    backend Express del alumno para verificar que su middleware proteja las rutas.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="usuario-github del alumno"
                  value={githubUser}
                  onChange={(e) => setGithubUser(e.target.value)}
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <Button
                  size="sm"
                  disabled={loadingSql || !githubUser.trim() || !isGitHubConfigured}
                  onClick={() => void loadStudentSchema()}
                >
                  {loadingSql ? 'Cargando...' : 'Cargar schema.sql de GitHub'}
                </Button>
              </div>

              {sqlError && <p className="text-xs text-[var(--status-err-fg)]">{sqlError}</p>}

              <textarea
                rows={5}
                placeholder="O pegá cualquier schema.sql acá para inspeccionar tablas y relaciones..."
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] p-3 font-mono text-xs text-[var(--text-primary)]"
              />

              {parsedTables.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {parsedTables.map((t) => (
                    <div
                      key={t.name}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-xs"
                    >
                      <p className="font-mono font-bold text-[var(--text-primary)]">{t.name}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {t.columns.length} columnas
                      </p>
                      {t.foreignKeys.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2 font-mono text-[11px] text-[var(--text-secondary)]">
                          {t.foreignKeys.map((fk) => (
                            <li key={fk}>FK: {fk}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
