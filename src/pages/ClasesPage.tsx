import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Unlock,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import { fetchMarkdownFile, githubConfig, isGitHubConfigured, listRepoPath } from '../lib/github';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import type { Clase } from '../types/database';

const SIDEBAR_STORAGE_KEY = 'campus-clases-sidebar-collapsed';

const FASE_LABELS: Record<number, string> = {
  0: 'Entrada en Calor',
  1: 'Fase 1 · Lógica TS',
  2: 'Fase 2 · React y SQL',
  3: 'Fase 3 · Seguridad y MVP',
};

const PREVIEW_CLASES: Clase[] = [
  { id: 1, numero: 0, titulo: 'Clase 0 — Entrada en Calor: Entorno, HTML/CSS y Primer PR', fase: 0, carpeta_repo: 'clases/clase-00', fecha_programada: null, duracion_hs: 2, modalidad: 'Pre-trabajo', link_llamada: null, estado: 'programada', desbloqueada: true, nota_cambio: null, gcal_event_id: null },
  { id: 2, numero: 1, titulo: 'Semana 1 — TypeScript: Tipos, Condicionales y Bucles', fase: 1, carpeta_repo: 'clases/semana-01', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 3, numero: 2, titulo: 'Semana 2 — Funciones Tipadas, Interfaces, Arrays y JSON', fase: 1, carpeta_repo: 'clases/semana-02', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 4, numero: 3, titulo: 'Semana 3 — HTTP, APIs REST y Asincronía', fase: 1, carpeta_repo: 'clases/semana-03', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 5, numero: 4, titulo: 'Semana 4 — Examen Eliminatorio 1 + Definición de MVP', fase: 1, carpeta_repo: 'clases/semana-04', fecha_programada: null, duracion_hs: 2, modalidad: 'Examen', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 6, numero: 5, titulo: 'Semana 5 — React + Vite + TypeScript + Tailwind', fase: 2, carpeta_repo: 'clases/semana-05', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 7, numero: 6, titulo: 'Semana 6 — Arquitectura de BD Relacionales y SQL Puro', fase: 2, carpeta_repo: 'clases/semana-06', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 8, numero: 7, titulo: 'Semana 7 — Supabase, Custom Hooks y TanStack Query', fase: 2, carpeta_repo: 'clases/semana-07', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 9, numero: 8, titulo: 'Semana 8 — Examen Eliminatorio 2', fase: 2, carpeta_repo: 'clases/semana-08', fecha_programada: null, duracion_hs: 2, modalidad: 'Examen', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 10, numero: 9, titulo: 'Semana 9 — Autenticación, Roles, RLS y Zustand', fase: 3, carpeta_repo: 'clases/semana-09', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 11, numero: 10, titulo: 'Semana 10 — Backend Propio en Node.js + Express + JWT', fase: 3, carpeta_repo: 'clases/semana-10', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 12, numero: 11, titulo: 'Semana 11 — Emancipación del MVP, Deploy y DNS', fase: 3, carpeta_repo: 'clases/semana-11', fecha_programada: null, duracion_hs: 2, modalidad: '2 hs', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
  { id: 13, numero: 12, titulo: 'Semana 12 — Examen Final y Defensa del MVP', fase: 3, carpeta_repo: 'clases/semana-12', fecha_programada: null, duracion_hs: 2, modalidad: 'Examen', link_llamada: null, estado: 'programada', desbloqueada: false, nota_cambio: null, gcal_event_id: null },
];

const PREVIEW_DOCS = [
  { name: 'programa-oficial.md', label: 'Programa Oficial', path: 'docs/programa-oficial.md' },
  { name: 'instalacion.md', label: 'Guía de Instalación', path: 'docs/instalacion.md' },
  { name: 'flujo-entregas.md', label: 'Flujo de Entregas (PR)', path: 'docs/flujo-entregas.md' },
  { name: 'diccionario-industria.md', label: 'Diccionario', path: 'docs/diccionario-industria.md' },
];

const PREVIEW_CLASE_0_MD = `# Clase 0 — Entrada en Calor (HTML + CSS + Primer Pull Request)

## Objetivo
Perder el miedo a VS Code, practicar el flujo profesional de **Fork + Pull Request** y armar una primera página web simple con HTML y CSS mientras preparamos la Clase 1 de TypeScript.

## Consigna
Creá dentro de \`entregas/<tu-usuario-github>/clase-00/\` dos archivos: \`index.html\` y \`styles.css\`.

Armá una **tarjeta de presentación** (puede ser tuya o de un negocio local: peluquería, gimnasio, despensa o rotisería) que incluya:

1. Un título principal (\`<h1>\`) y un subtítulo o descripción (\`<p>\`).
2. Una imagen (\`<img>\`).
3. Una lista de al menos 3 servicios, productos o gustos (\`<ul>\` y \`<li>\`).
4. Un enlace o botón (\`<a>\` o \`<button>\`).
5. En \`styles.css\`: colores sobrios, tipografía legible, bordes redondeados y la tarjeta centrada en pantalla.

## Cómo entregarla
Seguí los 5 pasos de la **Guía de Entregas (PR)** y abrí tu primer Pull Request antes de la Clase 1. Al arrancar la Clase 1 lo revisamos y mergeamos en vivo.`;

export function ClasesPage() {
  const queryClient = useQueryClient();
  const esStaff = useAuthStore((s) => s.esStaff)();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  const [openFases, setOpenFases] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: false,
    3: false,
  });

  const [selectedClaseNum, setSelectedClaseNum] = useState<number>(0);
  const [selectedDocPath, setSelectedDocPath] = useState<string | null>(null);
  const [previewClases, setPreviewClases] = useState<Clase[]>(PREVIEW_CLASES);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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

  const docsQuery = useQuery({
    queryKey: ['github', 'docs'],
    queryFn: () => listRepoPath('docs'),
    enabled: isGitHubConfigured,
  });

  const clases = isSupabaseConfigured ? (clasesDbQuery.data ?? []) : previewClases;

  const selectedClase = useMemo(
    () => clases.find((c) => c.numero === selectedClaseNum) ?? clases[0] ?? null,
    [clases, selectedClaseNum],
  );

  const canReadSelectedClase = Boolean(
    selectedClase && (selectedClase.desbloqueada || esStaff || !isSupabaseConfigured),
  );

  const activeGithubPath = selectedDocPath
    ? selectedDocPath
    : selectedClase && canReadSelectedClase
      ? `${selectedClase.carpeta_repo}/consigna.md`
      : null;

  const markdownQuery = useQuery({
    queryKey: ['github', 'markdown', activeGithubPath],
    queryFn: () => fetchMarkdownFile(activeGithubPath!),
    enabled: isGitHubConfigured && Boolean(activeGithubPath),
  });

  const toggleDesbloqueoMutation = useMutation({
    mutationFn: async ({ id, desbloqueada }: { id: number; desbloqueada: boolean }) => {
      if (!isSupabaseConfigured) {
        setPreviewClases((prev) =>
          prev.map((c) => (c.id === id ? { ...c, desbloqueada } : c)),
        );
        return;
      }
      const { error } = await supabase!
        .from('clases')
        .update({ desbloqueada })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey: ['supabase', 'clases'] });
      }
    },
  });

  const repoUrl = isGitHubConfigured
    ? `https://github.com/${githubConfig.owner}/${githubConfig.repo}`
    : null;

  const docsList = isGitHubConfigured
    ? (docsQuery.data ?? []).map((d) => ({
        name: d.name,
        label: d.name.replace(/\.md$/i, '').replace(/-/g, ' '),
        path: d.path,
      }))
    : PREVIEW_DOCS;

  const canToggleUnlock = esStaff || !isSupabaseConfigured;
  const isLockedForViewer = Boolean(
    !selectedDocPath && selectedClase && !selectedClase.desbloqueada && !canToggleUnlock,
  );

  function toggleFase(fase: number) {
    setOpenFases((prev) => ({ ...prev, [fase]: !prev[fase] }));
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full">
      {/* Sidebar colapsable */}
      <aside
        aria-label="Índice de clases y documentación"
        className={`shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-12' : 'w-60'
        }`}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expandir panel lateral"
              aria-label="Expandir panel lateral"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>

            <div className="my-1 h-px w-6 bg-[var(--border)]" />

            <div className="flex flex-col items-center gap-1">
              {clases.map((clase) => {
                const active = !selectedDocPath && selectedClaseNum === clase.numero;
                const locked = !clase.desbloqueada;
                return (
                  <button
                    key={clase.id}
                    type="button"
                    onClick={() => {
                      setSelectedDocPath(null);
                      setSelectedClaseNum(clase.numero);
                    }}
                    title={clase.titulo}
                    className={`flex h-7 w-8 items-center justify-center rounded-md font-mono text-xs transition ${
                      active
                        ? 'bg-[var(--cta-bg)] font-semibold text-[var(--cta-fg)]'
                        : locked
                          ? 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {String(clase.numero).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col p-3">
            <div className="mb-3 flex items-center justify-between px-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Clases
              </span>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                title="Achicar panel lateral"
                aria-label="Achicar panel lateral"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto">
              {isSupabaseConfigured && clasesDbQuery.isLoading ? (
                <div className="space-y-2 px-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-4/5" />
                </div>
              ) : (
                [0, 1, 2, 3].map((fase) => {
                const items = clases.filter((c) => c.fase === fase);
                if (items.length === 0) return null;
                const isOpen = Boolean(openFases[fase]);

                return (
                  <div key={fase}>
                    <button
                      type="button"
                      onClick={() => toggleFase(fase)}
                      className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    >
                      <span className="truncate">{FASE_LABELS[fase]}</span>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <ul className="mt-1 space-y-0.5">
                        {items.map((clase) => {
                          const active = !selectedDocPath && selectedClaseNum === clase.numero;
                          const locked = !clase.desbloqueada;
                          const shortLabel =
                            clase.numero === 0
                              ? 'Clase 0 · Entrada en calor'
                              : `Semana ${clase.numero}`;

                          return (
                            <li key={clase.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDocPath(null);
                                  setSelectedClaseNum(clase.numero);
                                }}
                                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                                  active
                                    ? 'bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]'
                                    : locked
                                      ? 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <span className="truncate">{shortLabel}</span>
                                {locked ? (
                                  <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                ) : (
                                  <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-ok-fg)]"
                                    title="Desbloqueada"
                                  />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
              )}
            </div>

            <div className="my-4 h-px bg-[var(--border)]" />

            <div>
              <p className="mb-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Docs
              </p>
              {isGitHubConfigured && docsQuery.isLoading ? (
                <div className="space-y-1.5 px-1.5">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : (
              <ul className="space-y-0.5">
                {docsList.map((doc) => {
                  const active = selectedDocPath === doc.path;
                  return (
                    <li key={doc.path}>
                      <button
                        type="button"
                        onClick={() => setSelectedDocPath(doc.path)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm capitalize transition ${
                          active
                            ? 'bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{doc.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Zona principal de lectura */}
      <section className="min-w-0 flex-1 bg-[var(--bg-canvas)] px-6 py-8 md:px-12 lg:px-16">
        <div className={`mx-auto transition-[max-width] duration-200 ${sidebarCollapsed ? 'max-w-4xl' : 'max-w-3xl'}`}>
          {selectedDocPath ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Documentación · {selectedDocPath}
                </span>
                {repoUrl && (
                  <a
                    href={`${repoUrl}/blob/main/${selectedDocPath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Ver en GitHub <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {isGitHubConfigured ? (
                markdownQuery.isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                    <Spinner label="Cargando documento desde GitHub..." className="pt-2" />
                  </div>
                ) : markdownQuery.isError ? (
                  <p className="text-sm text-[var(--status-err-fg)]">
                    {(markdownQuery.error as Error).message}
                  </p>
                ) : (
                  <article className="campus-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {markdownQuery.data ?? ''}
                    </ReactMarkdown>
                  </article>
                )
              ) : (
                <div className="campus-prose">
                  <h1>{docsList.find((d) => d.path === selectedDocPath)?.label}</h1>
                  <p>
                    Configurá <code>VITE_GITHUB_OWNER</code> y <code>VITE_GITHUB_REPO</code> en{' '}
                    <code>.env</code> para leer el Markdown real desde <code>{selectedDocPath}</code>.
                  </p>
                </div>
              )}
            </div>
          ) : selectedClase ? (
            <div className="space-y-8">
              {/* Cabecera limpia de la clase */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {FASE_LABELS[selectedClase.fase]}
                  </span>
                  <span className="text-[var(--border-strong)]">/</span>
                  {selectedClase.desbloqueada ? (
                    <Badge variant="success">
                      <Unlock className="h-3 w-3" />
                      Desbloqueada
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <Lock className="h-3 w-3" />
                      Bloqueada
                    </Badge>
                  )}
                </div>

                {canToggleUnlock && (
                  <Button
                    variant={selectedClase.desbloqueada ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={toggleDesbloqueoMutation.isPending}
                    onClick={() =>
                      toggleDesbloqueoMutation.mutate({
                        id: selectedClase.id,
                        desbloqueada: !selectedClase.desbloqueada,
                      })
                    }
                  >
                    {selectedClase.desbloqueada ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        Bloquear semana
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3.5 w-3.5" />
                        Desbloquear semana
                      </>
                    )}
                  </Button>
                )}
              </div>

              {isLockedForViewer ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 space-y-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                    {selectedClase.titulo}
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
                    Esta clase todavía está bloqueada en el Campus y se habilitará cuando lleguemos
                    a esta semana. Si querés adelantar por tu cuenta, podés investigar la carpeta
                    directamente en el repositorio de GitHub.
                  </p>
                  {repoUrl && (
                    <div className="pt-2">
                      <a
                        href={`${repoUrl}/tree/main/${selectedClase.carpeta_repo}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button variant="primary">
                          Explorar en GitHub <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              ) : isGitHubConfigured ? (
                markdownQuery.isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-3/4" />
                    <Spinner label="Cargando consigna desde GitHub..." className="pt-2" />
                  </div>
                ) : markdownQuery.isError ? (
                  <p className="text-sm text-[var(--status-err-fg)]">
                    {(markdownQuery.error as Error).message}
                  </p>
                ) : (
                  <article className="campus-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {markdownQuery.data ?? ''}
                    </ReactMarkdown>
                  </article>
                )
              ) : (
                <article className="campus-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedClase.numero === 0
                      ? PREVIEW_CLASE_0_MD
                      : `# ${selectedClase.titulo}\n\nVista previa local. Conectá \`VITE_GITHUB_OWNER\` y \`VITE_GITHUB_REPO\` en \`.env\` para cargar \`${selectedClase.carpeta_repo}/consigna.md\` desde GitHub.`}
                  </ReactMarkdown>
                </article>
              )}

              {/* Acción primaria sobria al pie */}
              {!isLockedForViewer && (
                <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
                  <Button
                    variant="primary"
                    onClick={() => setSelectedDocPath('docs/flujo-entregas.md')}
                  >
                    Ver guía de entrega (PR)
                  </Button>
                  {repoUrl && (
                    <a
                      href={`${repoUrl}/tree/main/${selectedClase.carpeta_repo}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button variant="secondary">
                        Abrir carpeta en GitHub <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
