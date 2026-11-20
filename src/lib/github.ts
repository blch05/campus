import type {
  EntregaProyectoGitHub,
  EvaluacionRutaPR,
  GitHubContentItem,
  GitHubPullRequest,
  GitHubPullRequestFile,
  GitHubTreeResponse,
} from '../types/github';

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const CACHE_PREFIX = 'wtdev-gh-cache:';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export const githubConfig = {
  owner: import.meta.env.VITE_GITHUB_OWNER ?? '',
  repo: import.meta.env.VITE_GITHUB_REPO ?? '',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  token: import.meta.env.VITE_GITHUB_TOKEN ?? '',
};

export const isGitHubConfigured = Boolean(githubConfig.owner && githubConfig.repo);

export class GitHubApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
  }
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (githubConfig.token) {
    headers.Authorization = `Bearer ${githubConfig.token}`;
  }
  return headers;
}

function readCache<T>(key: string, allowStale = false, ttlMs = CACHE_TTL_MS): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: T };
    if (!allowStale && Date.now() - parsed.ts > ttlMs) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Si localStorage está lleno, limpiamos solo el caché de GitHub y reintentamos
    try {
      clearGitHubCache();
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Ignore storage errors
    }
  }
}

export function clearGitHubCache(subKey?: string): void {
  try {
    const prefix = CACHE_PREFIX + (subKey ?? '');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

async function fetchGitHub<T>(endpoint: string): Promise<T> {
  if (!isGitHubConfigured) {
    throw new Error('Configurá VITE_GITHUB_OWNER y VITE_GITHUB_REPO en tu archivo .env.');
  }
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      const resetUnix = Number(response.headers.get('x-ratelimit-reset') ?? 0);
      const resetTime = resetUnix
        ? new Date(resetUnix * 1000).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'unos minutos';
      throw new GitHubApiError(
        403,
        `Límite de consultas a GitHub API alcanzado (60/hora sin token). Se restablece a las ${resetTime}.`,
      );
    }
    throw new GitHubApiError(
      response.status,
      `Error de GitHub API (${response.status}): ${response.statusText}`,
    );
  }
  return (await response.json()) as T;
}

async function probeRawAdjuntos(folderPath: string): Promise<GitHubContentItem[]> {
  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  const candidates = ['presentacion.html', 'datos.json'];
  const found: GitHubContentItem[] = [];

  await Promise.all(
    candidates.map(async (name) => {
      const filePath = `${cleanFolder}/${name}`;
      const rawUrl = `${GITHUB_RAW}/${githubConfig.owner}/${githubConfig.repo}/${githubConfig.branch}/${filePath}`;
      try {
        const res = await fetch(rawUrl, { method: 'HEAD' });
        if (res.ok) {
          found.push({
            name,
            path: filePath,
            type: 'file',
            download_url: rawUrl,
            html_url: `https://github.com/${githubConfig.owner}/${githubConfig.repo}/blob/${githubConfig.branch}/${filePath}`,
          });
        }
      } catch {
        // Ignore probe failures
      }
    }),
  );

  return found;
}

export async function listRepoPath(path: string): Promise<GitHubContentItem[]> {
  const cacheKey = `path:${githubConfig.owner}/${githubConfig.repo}:${path}`;
  const cached = readCache<GitHubContentItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchGitHub<GitHubContentItem[]>(
      `/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${path}`,
    );
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    const stale = readCache<GitHubContentItem[]>(cacheKey, true);
    if (stale) return stale;

    // Fallback sin cuota de API para carpetas de clases cuando hay 403 rate limit
    if (err instanceof GitHubApiError && err.status === 403 && path.startsWith('clases/')) {
      const probed = await probeRawAdjuntos(path);
      if (probed.length > 0) {
        writeCache(cacheKey, probed);
        return probed;
      }
    }
    throw err;
  }
}

export async function fetchMarkdownFile(path: string): Promise<string> {
  if (!isGitHubConfigured) {
    throw new Error('Configurá VITE_GITHUB_OWNER y VITE_GITHUB_REPO en tu archivo .env.');
  }
  const cleanPath = path.replace(/^\/+/, '');
  const cacheKey = `file:${githubConfig.owner}/${githubConfig.repo}:${githubConfig.branch}:${cleanPath}`;
  const cached = readCache<string>(cacheKey);
  if (cached !== null) return cached;

  const rawUrl = `${GITHUB_RAW}/${githubConfig.owner}/${githubConfig.repo}/${githubConfig.branch}/${cleanPath}`;
  try {
    const res = await fetch(rawUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new GitHubApiError(res.status, `No se pudo descargar ${cleanPath} (${res.status})`);
    }
    const text = await res.text();
    writeCache(cacheKey, text);
    return text;
  } catch (err) {
    const stale = readCache<string>(cacheKey, true);
    if (stale !== null) return stale;
    throw err;
  }
}

const PR_LIST_TTL_MS = 2 * 60 * 1000; // 2 min
const PR_FILES_TTL_MS = 10 * 60 * 1000; // 10 min

async function fetchGitHubCached<T>(
  cacheKey: string,
  endpoint: string,
  ttlMs: number,
): Promise<T> {
  const cached = readCache<T>(cacheKey, false, ttlMs);
  if (cached !== null) return cached;

  try {
    const data = await fetchGitHub<T>(endpoint);
    writeCache(cacheKey, data);
    return data;
  } catch (err) {
    const stale = readCache<T>(cacheKey, true);
    if (stale !== null) return stale;
    throw err;
  }
}

export function listOpenPullRequests(): Promise<GitHubPullRequest[]> {
  return fetchGitHubCached<GitHubPullRequest[]>(
    `prs:${githubConfig.owner}/${githubConfig.repo}:open`,
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls?state=open&per_page=50`,
    PR_LIST_TTL_MS,
  );
}

export function getPullRequest(prNumber: number): Promise<GitHubPullRequest> {
  return fetchGitHubCached<GitHubPullRequest>(
    `pr:${githubConfig.owner}/${githubConfig.repo}:${prNumber}`,
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls/${prNumber}`,
    PR_FILES_TTL_MS,
  );
}

export function listPullRequestFiles(prNumber: number): Promise<GitHubPullRequestFile[]> {
  return fetchGitHubCached<GitHubPullRequestFile[]>(
    `pr-files:${githubConfig.owner}/${githubConfig.repo}:${prNumber}`,
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls/${prNumber}/files?per_page=100`,
    PR_FILES_TTL_MS,
  );
}

export function validarGuardianDeRutas(
  authorLogin: string,
  files: GitHubPullRequestFile[],
): EvaluacionRutaPR {
  const author = authorLogin.toLowerCase();
  const owner = githubConfig.owner.toLowerCase();
  const prefijoEsperado = `entregas/${author}/`;

  const archivosProhibidos =
    author === owner
      ? []
      : files
          .map((f) => f.filename)
          .filter((name) => !name.toLowerCase().startsWith(prefijoEsperado));

  return {
    permitido: archivosProhibidos.length === 0,
    prefijoEsperado,
    archivosProhibidos,
  };
}

const ENTREGAS_TREE_TTL_MS = 5 * 60 * 1000; // 5 min

function formatCarpetaLabel(carpeta: string): string {
  if (carpeta.toLowerCase() === 'mvp') return 'MVP Final';
  return carpeta
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function extractHtmlTitle(rawUrl: string): Promise<string | null> {
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = match?.[1]?.trim();
    return title ? title.slice(0, 80) : null;
  } catch {
    return null;
  }
}

async function fetchMvpManifest(
  rawUrl: string,
): Promise<{ titulo?: string; url?: string; repo_url?: string } | null> {
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return {
      titulo: typeof data.titulo === 'string' ? data.titulo.trim() : undefined,
      url: typeof data.url === 'string' ? data.url.trim() : undefined,
      repo_url: typeof data.repo_url === 'string' ? data.repo_url.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export async function listEntregasProyectos(): Promise<EntregaProyectoGitHub[]> {
  if (!isGitHubConfigured) return [];

  const { owner, repo, branch } = githubConfig;
  const cacheKey = `entregas-tree:${owner}/${repo}:${branch}`;
  const treeRes = await fetchGitHubCached<GitHubTreeResponse>(
    cacheKey,
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    ENTREGAS_TREE_TTL_MS,
  );

  // Agrupar archivos dentro de entregas/<usuario>/<carpeta>/...
  const groups = new Map<
    string,
    { username: string; carpeta: string; files: string[] }
  >();

  for (const entry of treeRes.tree) {
    if (entry.type !== 'blob') continue;
    const match = entry.path.match(/^entregas\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, username, carpeta, relFile] = match;
    const id = `${username}/${carpeta}`;
    const existing = groups.get(id);
    if (existing) {
      existing.files.push(relFile);
    } else {
      groups.set(id, { username, carpeta, files: [relFile] });
    }
  }

  const proyectos = await Promise.all(
    Array.from(groups.entries()).map(async ([id, group]): Promise<EntregaProyectoGitHub> => {
      const baseFolder = `entregas/${group.username}/${group.carpeta}`;
      const defaultRepoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${baseFolder}`;
      const hasMvpJson = group.files.some((f) => f.toLowerCase() === 'mvp.json');
      const indexFile = group.files.find((f) => f.toLowerCase() === 'index.html');

      if (hasMvpJson) {
        const rawManifest = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${baseFolder}/mvp.json`;
        const manifest = await fetchMvpManifest(rawManifest);
        return {
          id,
          github_username: group.username,
          carpeta: group.carpeta,
          titulo: manifest?.titulo || `MVP — @${group.username}`,
          preview_url: manifest?.url || null,
          repo_url: manifest?.repo_url || defaultRepoUrl,
          tipo: 'mvp',
          archivos: group.files.length,
        };
      }

      if (indexFile) {
        const rawHtml = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${baseFolder}/${indexFile}`;
        const htmlTitle = await extractHtmlTitle(rawHtml);
        return {
          id,
          github_username: group.username,
          carpeta: group.carpeta,
          titulo: htmlTitle || formatCarpetaLabel(group.carpeta),
          preview_url: `https://raw.githack.com/${owner}/${repo}/${branch}/${baseFolder}/${indexFile}`,
          repo_url: defaultRepoUrl,
          tipo: 'web',
          archivos: group.files.length,
        };
      }

      return {
        id,
        github_username: group.username,
        carpeta: group.carpeta,
        titulo: formatCarpetaLabel(group.carpeta),
        preview_url: null,
        repo_url: defaultRepoUrl,
        tipo: 'codigo',
        archivos: group.files.length,
      };
    }),
  );

  return proyectos.sort((a, b) => {
    if (a.tipo === 'mvp' && b.tipo !== 'mvp') return -1;
    if (b.tipo === 'mvp' && a.tipo !== 'mvp') return 1;
    const folderCmp = b.carpeta.localeCompare(a.carpeta);
    if (folderCmp !== 0) return folderCmp;
    return a.github_username.localeCompare(b.github_username);
  });
}
