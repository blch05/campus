import type {
  EvaluacionRutaPR,
  GitHubContentItem,
  GitHubPullRequest,
  GitHubPullRequestFile,
} from '../types/github';

const GITHUB_API = 'https://api.github.com';

export const githubConfig = {
  owner: import.meta.env.VITE_GITHUB_OWNER ?? '',
  repo: import.meta.env.VITE_GITHUB_REPO ?? '',
};

export const isGitHubConfigured = Boolean(githubConfig.owner && githubConfig.repo);

function buildHeaders(): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
  };
}

async function fetchGitHub<T>(endpoint: string): Promise<T> {
  if (!isGitHubConfigured) {
    throw new Error('Configurá VITE_GITHUB_OWNER y VITE_GITHUB_REPO en tu archivo .env.');
  }
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    headers: buildHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error de GitHub API (${response.status}): ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function listRepoPath(path: string): Promise<GitHubContentItem[]> {
  return fetchGitHub<GitHubContentItem[]>(
    `/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${path}`,
  );
}

export async function fetchMarkdownFile(path: string): Promise<string> {
  const item = await fetchGitHub<GitHubContentItem & { content?: string }>(
    `/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${path}`,
  );
  if (!item.download_url) {
    throw new Error(`No se encontró contenido descargable en ${path}`);
  }
  const res = await fetch(item.download_url);
  if (!res.ok) {
    throw new Error(`No se pudo descargar ${path} (${res.status})`);
  }
  return res.text();
}

export function listOpenPullRequests(): Promise<GitHubPullRequest[]> {
  return fetchGitHub<GitHubPullRequest[]>(
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls?state=open&per_page=50`,
  );
}

export function getPullRequest(prNumber: number): Promise<GitHubPullRequest> {
  return fetchGitHub<GitHubPullRequest>(
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls/${prNumber}`,
  );
}

export function listPullRequestFiles(prNumber: number): Promise<GitHubPullRequestFile[]> {
  return fetchGitHub<GitHubPullRequestFile[]>(
    `/repos/${githubConfig.owner}/${githubConfig.repo}/pulls/${prNumber}/files?per_page=100`,
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
