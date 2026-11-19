export type RolUsuario = 'estudiante' | 'profesor';
export type EstadoAlumno = 'activo' | 'atrasado' | 'baja';
export type EstadoClase = 'programada' | 'reprogramada' | 'dictada' | 'cancelada';
export type EstadoEntrega = 'pendiente' | 'en_revision' | 'aprobada' | 'prorroga' | 'desaprobada';
export type EstadoExamen = 'pendiente' | 'aprobado' | 'recuperatorio' | 'baja';
export type HitoExamen = 1 | 2 | 3;

export interface Alumno {
  id: string;
  user_id: string | null;
  nombre: string;
  email: string;
  github_username: string;
  rol: RolUsuario;
  es_admin: boolean;
  estado: EstadoAlumno;
  nota_excepcion: string | null;
  mvp_titulo: string | null;
  mvp_url: string | null;
  mvp_repo_url: string | null;
  mvp_api_url: string | null;
  created_at: string;
}

export interface Clase {
  id: number;
  numero: number;
  titulo: string;
  fase: 0 | 1 | 2 | 3;
  carpeta_repo: string;
  fecha_programada: string | null;
  duracion_hs: number | null;
  modalidad: string | null;
  link_llamada: string | null;
  estado: EstadoClase;
  nota_cambio: string | null;
  gcal_event_id: string | null;
}

export interface Entrega {
  id: string;
  alumno_id: string;
  clase_numero: number;
  pr_number: number | null;
  estado: EstadoEntrega;
  fecha_limite_override: string | null;
  observacion: string | null;
  updated_at: string;
}

export interface Examen {
  id: string;
  alumno_id: string;
  hito: HitoExamen;
  nota_oral: number | null;
  nota_live: number | null;
  nota_entregable: number | null;
  nota_final: number;
  es_recuperatorio: boolean;
  estado: EstadoExamen;
  observacion: string | null;
  updated_at: string;
}

export interface ProyectoCohorte {
  nombre: string;
  github_username: string;
  mvp_titulo: string | null;
  mvp_url: string | null;
  mvp_repo_url: string | null;
  mvp_api_url: string | null;
}
