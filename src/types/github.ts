export interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubPullRequestFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface EvaluacionRutaPR {
  permitido: boolean;
  prefijoEsperado: string;
  archivosProhibidos: string[];
}

export interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

export interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface EntregaProyectoGitHub {
  id: string;
  github_username: string;
  carpeta: string;
  titulo: string;
  preview_url: string | null;
  repo_url: string;
  tipo: 'web' | 'mvp' | 'codigo';
  archivos: number;
}
