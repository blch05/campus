import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ExternalLink, Lock, Pencil, Plus, Trash2, Unlock, Video, X } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import { formatAppError, parseAppError } from '../lib/errors';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { safeExternalUrl } from '../lib/url';
import { useAuthStore } from '../store/useAuthStore';
import type {
  Alumno,
  Clase,
  Entrega,
  EstadoAlumno,
  EstadoClase,
  EstadoEntrega,
  EstadoExamen,
  Examen,
  HitoExamen,
  RolUsuario,
} from '../types/database';

type TabLibreta = 'cronograma' | 'entregas' | 'examenes' | 'alumnos';

const ESTADO_ENTREGA_BADGE: Record<EstadoEntrega, 'neutral' | 'success' | 'warning' | 'error'> = {
  pendiente: 'neutral',
  en_revision: 'warning',
  aprobada: 'success',
  prorroga: 'warning',
  desaprobada: 'error',
};

const ESTADO_EXAMEN_BADGE: Record<EstadoExamen, 'neutral' | 'success' | 'warning' | 'error'> = {
  pendiente: 'neutral',
  aprobado: 'success',
  recuperatorio: 'warning',
  baja: 'error',
};

const VALID_TABS: TabLibreta[] = ['cronograma', 'entregas', 'examenes', 'alumnos'];

const ESTADO_CLASE_BADGE: Record<EstadoClase, 'neutral' | 'success' | 'warning' | 'error'> = {
  programada: 'neutral',
  reprogramada: 'warning',
  dictada: 'success',
  cancelada: 'error',
};

function toDateTimeLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatClaseFecha(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LibretaPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const perfil = useAuthStore((s) => s.perfil);
  const esStaff = useAuthStore((s) => s.esStaff)();
  const esAdmin = useAuthStore((s) => s.esAdmin)();

  const rawTab = searchParams.get('tab') as TabLibreta | null;
  const tab: TabLibreta =
    rawTab && VALID_TABS.includes(rawTab) && (rawTab !== 'alumnos' || esStaff)
      ? rawTab
      : 'cronograma';

  function setTab(next: TabLibreta) {
    setSearchParams({ tab: next }, { replace: true });
  }

  // Form: alta de alumno (solo admin)
  const [newNombre, setNewNombre] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGithub, setNewGithub] = useState('');
  const [newRol, setNewRol] = useState<RolUsuario>('estudiante');
  const [newEsAdmin, setNewEsAdmin] = useState(false);

  // Form: cargar/actualizar entrega (staff)
  const [entAlumnoId, setEntAlumnoId] = useState('');
  const [entClaseNum, setEntClaseNum] = useState<number>(0);
  const [entPrNum, setEntPrNum] = useState('');
  const [entEstado, setEntEstado] = useState<EstadoEntrega>('aprobada');
  const [entObs, setEntObs] = useState('');

  // Form: cargar/actualizar examen (staff)
  const [exAlumnoId, setExAlumnoId] = useState('');
  const [exHito, setExHito] = useState<HitoExamen>(1);
  const [exOral, setExOral] = useState('');
  const [exLive, setExLive] = useState('');
  const [exEntregable, setExEntregable] = useState('');
  const [exRecup, setExRecup] = useState(false);
  const [exObs, setExObs] = useState('');

  // Form: programar/editar clase (staff)
  const [editClaseId, setEditClaseId] = useState<number | null>(null);
  const [editClaseTitulo, setEditClaseTitulo] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editModalidad, setEditModalidad] = useState('');
  const [editEstadoClase, setEditEstadoClase] = useState<EstadoClase>('programada');
  const [editNotaCambio, setEditNotaCambio] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    tipo: 'entrega' | 'examen' | 'alumno';
    id: string;
  } | null>(null);

  // Form: editar alumno existente (solo admin)
  const [editAlumnoId, setEditAlumnoId] = useState<string | null>(null);
  const [editAlNombre, setEditAlNombre] = useState('');
  const [editAlGithub, setEditAlGithub] = useState('');
  const [editAlRol, setEditAlRol] = useState<RolUsuario>('estudiante');
  const [editAlEsAdmin, setEditAlEsAdmin] = useState(false);
  const [editAlEstado, setEditAlEstado] = useState<EstadoAlumno>('activo');
  const [editAlMvpTitulo, setEditAlMvpTitulo] = useState('');
  const [editAlMvpUrl, setEditAlMvpUrl] = useState('');
  const [editAlMvpRepoUrl, setEditAlMvpRepoUrl] = useState('');

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

  const entregasQuery = useQuery({
    queryKey: ['supabase', 'entregas'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('entregas')
        .select('*')
        .order('clase_numero', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entrega[];
    },
  });

  const examenesQuery = useQuery({
    queryKey: ['supabase', 'examenes'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('examenes')
        .select('*')
        .order('hito', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Examen[];
    },
  });

  const toggleClaseMutation = useMutation({
    mutationFn: async ({ id, desbloqueada }: { id: number; desbloqueada: boolean }) => {
      const { error } = await supabase!
        .from('clases')
        .update({ desbloqueada })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'clases'] });
    },
  });

  const updateClaseScheduleMutation = useMutation({
    mutationFn: async () => {
      if (editClaseId === null) throw new Error('Ninguna clase seleccionada.');
      const trimmedLink = editLink.trim();
      if (trimmedLink && !safeExternalUrl(trimmedLink)) {
        throw new Error('El link de la llamada debe empezar con https:// o http://.');
      }
      const isoFecha = editFecha ? new Date(editFecha).toISOString() : null;
      const { error } = await supabase!
        .from('clases')
        .update({
          fecha_programada: isoFecha,
          link_llamada: trimmedLink || null,
          modalidad: editModalidad.trim() || null,
          estado: editEstadoClase,
          nota_cambio: editNotaCambio.trim() || null,
        })
        .eq('id', editClaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditClaseId(null);
      setFeedback({ type: 'ok', text: 'Cronograma de la clase actualizado.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'clases'] });
    },
    onError: (err) => {
      setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    },
  });

  function openEditClase(clase: Clase) {
    setFeedback(null);
    setEditClaseId(clase.id);
    setEditClaseTitulo(clase.titulo);
    setEditFecha(toDateTimeLocalInput(clase.fecha_programada));
    setEditLink(clase.link_llamada ?? '');
    setEditModalidad(clase.modalidad ?? '2 hs (Compacto)');
    setEditEstadoClase(clase.estado);
    setEditNotaCambio(clase.nota_cambio ?? '');
  }

  function handleSaveClaseSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    updateClaseScheduleMutation.mutate();
  }

  const createAlumnoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from('alumnos').insert({
        nombre: newNombre.trim(),
        email: newEmail.trim().toLowerCase(),
        github_username: newGithub.trim().toLowerCase().replace(/^@/, ''),
        rol: newRol,
        es_admin: newEsAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNombre('');
      setNewEmail('');
      setNewGithub('');
      setNewRol('estudiante');
      setNewEsAdmin(false);
      setFeedback({ type: 'ok', text: 'Usuario agregado correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'alumnos'] });
    },
    onError: (err) => setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) }),
  });

  const updateAlumnoEstadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoAlumno }) => {
      const { error } = await supabase!.from('alumnos').update({ estado }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedback({ type: 'ok', text: 'Estado del usuario actualizado.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'alumnos'] });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'proyectos_cohorte'] });
    },
    onError: (err) => setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) }),
  });

  const updateAlumnoMutation = useMutation({
    mutationFn: async () => {
      if (!editAlumnoId) throw new Error('Ningún usuario seleccionado.');
      const cleanMvpUrl = editAlMvpUrl.trim();
      const cleanMvpRepo = editAlMvpRepoUrl.trim();
      if (cleanMvpUrl && !safeExternalUrl(cleanMvpUrl)) {
        throw new Error('La URL del MVP debe empezar con https:// o http://.');
      }
      if (cleanMvpRepo && !safeExternalUrl(cleanMvpRepo)) {
        throw new Error('La URL del repositorio debe empezar con https:// o http://.');
      }
      const isSelf = perfil?.id === editAlumnoId;
      const { error } = await supabase!
        .from('alumnos')
        .update({
          nombre: editAlNombre.trim(),
          github_username: editAlGithub.trim().toLowerCase().replace(/^@/, ''),
          rol: editAlRol,
          es_admin: isSelf ? true : editAlEsAdmin,
          estado: editAlEstado,
          mvp_titulo: editAlMvpTitulo.trim() || null,
          mvp_url: cleanMvpUrl || null,
          mvp_repo_url: cleanMvpRepo || null,
        })
        .eq('id', editAlumnoId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditAlumnoId(null);
      setFeedback({ type: 'ok', text: 'Usuario actualizado correctamente.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'alumnos'] });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'proyectos_cohorte'] });
    },
    onError: (err) => setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) }),
  });

  const deleteAlumnoMutation = useMutation({
    mutationFn: async (id: string) => {
      if (perfil?.id === id) {
        throw new Error('No podés eliminar tu propia cuenta de administrador.');
      }
      const { error } = await supabase!.from('alumnos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmDelete(null);
      setFeedback({ type: 'ok', text: 'Usuario eliminado de la cohorte.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'alumnos'] });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'proyectos_cohorte'] });
    },
    onError: (err) => {
      setConfirmDelete(null);
      setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    },
  });

  function openEditAlumno(a: Alumno) {
    setFeedback(null);
    setConfirmDelete(null);
    setEditAlumnoId(a.id);
    setEditAlNombre(a.nombre);
    setEditAlGithub(a.github_username);
    setEditAlRol(a.rol);
    setEditAlEsAdmin(a.es_admin);
    setEditAlEstado(a.estado);
    setEditAlMvpTitulo(a.mvp_titulo ?? '');
    setEditAlMvpUrl(a.mvp_url ?? '');
    setEditAlMvpRepoUrl(a.mvp_repo_url ?? '');
  }

  function handleSaveAlumnoEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    updateAlumnoMutation.mutate();
  }

  const upsertEntregaMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from('entregas').upsert(
        {
          alumno_id: entAlumnoId,
          clase_numero: entClaseNum,
          pr_number: entPrNum ? Number(entPrNum) : null,
          estado: entEstado,
          observacion: entObs.trim() || null,
        },
        { onConflict: 'alumno_id,clase_numero' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setEntPrNum('');
      setEntObs('');
      setFeedback({ type: 'ok', text: 'Entrega guardada.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'entregas'] });
    },
    onError: (err) => setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) }),
  });

  const previewNotaFinal = (() => {
    const o = Number(exOral || 0);
    const l = Number(exLive || 0);
    const e = Number(exEntregable || 0);
    return Math.round((o * 0.3 + l * 0.4 + e * 0.3) * 100) / 100;
  })();

  const upsertExamenMutation = useMutation({
    mutationFn: async () => {
      const oral = exOral !== '' ? Number(exOral) : null;
      const live = exLive !== '' ? Number(exLive) : null;
      const ent = exEntregable !== '' ? Number(exEntregable) : null;
      const estadoCalc: EstadoExamen =
        oral === null && live === null && ent === null
          ? 'pendiente'
          : previewNotaFinal >= 7
            ? 'aprobado'
            : exRecup
              ? 'baja'
              : 'recuperatorio';

      const { error } = await supabase!.from('examenes').upsert(
        {
          alumno_id: exAlumnoId,
          hito: exHito,
          nota_oral: oral,
          nota_live: live,
          nota_entregable: ent,
          es_recuperatorio: exRecup,
          estado: estadoCalc,
          observacion: exObs.trim() || null,
        },
        { onConflict: 'alumno_id,hito,es_recuperatorio' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setExOral('');
      setExLive('');
      setExEntregable('');
      setExObs('');
      setFeedback({ type: 'ok', text: 'Nota de examen guardada.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'examenes'] });
    },
    onError: (err) => setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) }),
  });

  const deleteEntregaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!.from('entregas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmDelete(null);
      setFeedback({ type: 'ok', text: 'Entrega eliminada.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'entregas'] });
    },
    onError: (err) => {
      setConfirmDelete(null);
      setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    },
  });

  const deleteExamenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!.from('examenes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirmDelete(null);
      setFeedback({ type: 'ok', text: 'Examen eliminado.' });
      void queryClient.invalidateQueries({ queryKey: ['supabase', 'examenes'] });
    },
    onError: (err) => {
      setConfirmDelete(null);
      setFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    },
  });

  const alumnos = alumnosQuery.data ?? [];
  const alumnosById = new Map(alumnos.map((a) => [a.id, a]));
  const estudiantes = alumnos.filter((a) => a.rol === 'estudiante');

  function handleCreateAlumno(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    createAlumnoMutation.mutate();
  }

  function handleSaveEntrega(e: FormEvent) {
    e.preventDefault();
    if (!entAlumnoId) return;
    setFeedback(null);
    upsertEntregaMutation.mutate();
  }

  function handleSaveExamen(e: FormEvent) {
    e.preventDefault();
    if (!exAlumnoId) return;
    setFeedback(null);
    upsertExamenMutation.mutate();
  }

  const tabs: { id: TabLibreta; label: string; visible: boolean }[] = [
    { id: 'cronograma', label: 'Cronograma', visible: true },
    { id: 'entregas', label: 'Entregas', visible: true },
    { id: 'examenes', label: 'Exámenes', visible: true },
    { id: 'alumnos', label: 'Cohorte', visible: esStaff },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Libreta y Cronograma
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Seguimiento de clases, entregas semanales y exámenes eliminatorios (nota mínima 7).
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-1 text-xs">
          {tabs
            .filter((t) => t.visible)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setFeedback(null);
                }}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  tab === t.id
                    ? 'bg-[var(--cta-bg)] text-[var(--cta-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-2.5 text-xs ${
            feedback.type === 'error'
              ? 'border-[var(--status-err-border)] bg-[var(--status-err-bg)] text-[var(--status-err-fg)]'
              : 'border-[var(--status-ok-border)] bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)]'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* TAB 1: CRONOGRAMA */}
      {tab === 'cronograma' && (
        <div className="space-y-4">
          {esStaff && editClaseId !== null && (
            <form
              onSubmit={handleSaveClaseSchedule}
              className="space-y-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Programar clase
                  </p>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    {editClaseTitulo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditClaseId(null)}
                  className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  aria-label="Cerrar editor de clase"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)] lg:col-span-2">
                  <span>Link de la llamada (Meet / Discord / Zoom)</span>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/..."
                    value={editLink}
                    onChange={(e) => setEditLink(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Estado</span>
                  <select
                    value={editEstadoClase}
                    onChange={(e) => setEditEstadoClase(e.target.value as EstadoClase)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="programada">Programada</option>
                    <option value="reprogramada">Reprogramada</option>
                    <option value="dictada">Dictada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Modalidad</span>
                  <input
                    type="text"
                    placeholder="Ej: 2 hs (Compacto)"
                    value={editModalidad}
                    onChange={(e) => setEditModalidad(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)] sm:col-span-2 lg:col-span-3">
                  <span>Nota / aviso (opcional)</span>
                  <input
                    type="text"
                    placeholder="Ej: Traer VS Code, Node y Git instalados"
                    value={editNotaCambio}
                    onChange={(e) => setEditNotaCambio(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditClaseId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateClaseScheduleMutation.isPending}
                >
                  {updateClaseScheduleMutation.isPending ? 'Guardando...' : 'Guardar horario'}
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Clase / Semana</th>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Llamada</th>
                  <th className="px-4 py-3">Acceso</th>
                  {esStaff && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {clasesQuery.isLoading ? (
                  <tr>
                    <td colSpan={esStaff ? 6 : 5} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-11/12" />
                      <Skeleton className="h-5 w-4/5" />
                      <Spinner label="Cargando cronograma..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  clasesQuery.data?.map((clase) => {
                    const safeLink = safeExternalUrl(clase.link_llamada);
                    return (
                      <tr key={clase.id}>
                        <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                          {String(clase.numero).padStart(2, '0')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)]">
                            {clase.titulo}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span>Fase {clase.fase}</span>
                            {clase.modalidad && <span>· {clase.modalidad}</span>}
                            {clase.estado !== 'programada' && (
                              <Badge variant={ESTADO_CLASE_BADGE[clase.estado]}>
                                {clase.estado}
                              </Badge>
                            )}
                          </div>
                          {clase.nota_cambio && (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {clase.nota_cambio}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">
                          {formatClaseFecha(clase.fecha_programada)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs">
                          {safeLink ? (
                            <a
                              href={safeLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)] underline underline-offset-2"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Unirse
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={clase.desbloqueada ? 'success' : 'neutral'}>
                            {clase.desbloqueada ? 'Desbloqueada' : 'Bloqueada'}
                          </Badge>
                        </td>
                        {esStaff && (
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openEditClase(clase)}
                              >
                                <Calendar className="h-3.5 w-3.5" /> Programar
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={toggleClaseMutation.isPending}
                                onClick={() =>
                                  toggleClaseMutation.mutate({
                                    id: clase.id,
                                    desbloqueada: !clase.desbloqueada,
                                  })
                                }
                              >
                                {clase.desbloqueada ? (
                                  <>
                                    <Lock className="h-3.5 w-3.5" /> Bloquear
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="h-3.5 w-3.5" /> Abrir
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ENTREGAS */}
      {tab === 'entregas' && (
        <div className="space-y-6">
          {esStaff && (
            <form
              onSubmit={handleSaveEntrega}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:grid-cols-6"
            >
              <select
                required
                value={entAlumnoId}
                onChange={(e) => setEntAlumnoId(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)] sm:col-span-2"
              >
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} (@{a.github_username})
                  </option>
                ))}
              </select>

              <select
                value={entClaseNum}
                onChange={(e) => setEntClaseNum(Number(e.target.value))}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                {(clasesQuery.data ?? []).map((c) => (
                  <option key={c.numero} value={c.numero}>
                    {c.numero === 0 ? 'Clase 0' : `Semana ${c.numero}`}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                placeholder="PR #"
                value={entPrNum}
                onChange={(e) => setEntPrNum(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />

              <select
                value={entEstado}
                onChange={(e) => setEntEstado(e.target.value as EstadoEntrega)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_revision">En revisión</option>
                <option value="aprobada">Aprobada</option>
                <option value="prorroga">Prórroga</option>
                <option value="desaprobada">Desaprobada</option>
              </select>

              <Button type="submit" size="sm" disabled={upsertEntregaMutation.isPending}>
                Guardar
              </Button>

              <input
                type="text"
                maxLength={300}
                placeholder="Observación opcional (máx. 300 caracteres)..."
                value={entObs}
                onChange={(e) => setEntObs(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)] sm:col-span-6"
              />
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  {esStaff && <th className="px-4 py-3">Estudiante</th>}
                  <th className="px-4 py-3">Semana</th>
                  <th className="px-4 py-3">PR</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Observación</th>
                  {esStaff && <th className="px-4 py-3 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {entregasQuery.isLoading ? (
                  <tr>
                    <td colSpan={esStaff ? 6 : 4} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-5/6" />
                      <Spinner label="Cargando entregas..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  entregasQuery.data?.map((ent) => {
                  const alumno = alumnosById.get(ent.alumno_id);
                  const isConfirming =
                    confirmDelete?.tipo === 'entrega' && confirmDelete.id === ent.id;
                  return (
                    <tr key={ent.id}>
                      {esStaff && (
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {alumno?.nombre ?? ent.alumno_id}
                        </td>
                      )}
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {ent.clase_numero === 0 ? 'Clase 0' : `Semana ${ent.clase_numero}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {ent.pr_number ? `#${ent.pr_number}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ESTADO_ENTREGA_BADGE[ent.estado]}>{ent.estado}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {ent.observacion ?? '—'}
                      </td>
                      {esStaff && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deleteEntregaMutation.isPending}
                                onClick={() => deleteEntregaMutation.mutate(ent.id)}
                                className="rounded-md border border-[var(--status-err-border)] bg-[var(--status-err-bg)] px-2 py-1 text-xs font-medium text-[var(--status-err-fg)] hover:opacity-90 disabled:opacity-50"
                              >
                                {deleteEntregaMutation.isPending ? 'Borrando...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFeedback(null);
                                setConfirmDelete({ tipo: 'entrega', id: ent.id });
                              }}
                              title="Eliminar entrega"
                              aria-label="Eliminar entrega"
                              className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--status-err-border)] hover:bg-[var(--status-err-bg)] hover:text-[var(--status-err-fg)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
                )}
                {!entregasQuery.isLoading && (!entregasQuery.data || entregasQuery.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={esStaff ? 6 : 4}
                      className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]"
                    >
                      Todavía no hay entregas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EXÁMENES */}
      {tab === 'examenes' && (
        <div className="space-y-6">
          {esStaff && (
            <form
              onSubmit={handleSaveExamen}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:grid-cols-6"
            >
              <select
                required
                value={exAlumnoId}
                onChange={(e) => setExAlumnoId(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)] sm:col-span-2"
              >
                <option value="">Seleccionar estudiante...</option>
                {estudiantes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} (@{a.github_username})
                  </option>
                ))}
              </select>

              <select
                value={exHito}
                onChange={(e) => setExHito(Number(e.target.value) as HitoExamen)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value={1}>Examen 1 (Sem 4)</option>
                <option value={2}>Examen 2 (Sem 8)</option>
                <option value={3}>Examen Final (Sem 12)</option>
              </select>

              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                placeholder="Oral 30%"
                value={exOral}
                onChange={(e) => setExOral(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />

              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                placeholder="Pseudocódigo 40%"
                value={exLive}
                onChange={(e) => setExLive(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />

              <input
                type="number"
                step="0.5"
                min="0"
                max="10"
                placeholder="Entregable 30%"
                value={exEntregable}
                onChange={(e) => setExEntregable(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />

              <input
                type="text"
                maxLength={300}
                placeholder="Observación / devolución (máx. 300 caracteres)..."
                value={exObs}
                onChange={(e) => setExObs(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)] sm:col-span-3"
              />

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={exRecup}
                  onChange={(e) => setExRecup(e.target.checked)}
                />
                Recuperatorio
              </label>

              <div className="flex items-center justify-end gap-2 sm:col-span-2">
                <span className="font-mono text-xs text-[var(--text-secondary)]">
                  Final: <strong className="text-[var(--text-primary)]">{previewNotaFinal}</strong>
                </span>
                <Button type="submit" size="sm" disabled={upsertExamenMutation.isPending}>
                  Guardar nota
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  {esStaff && <th className="px-4 py-3">Estudiante</th>}
                  <th className="px-4 py-3">Hito</th>
                  <th className="px-4 py-3">Oral (30%)</th>
                  <th className="px-4 py-3">Pseudocódigo (40%)</th>
                  <th className="px-4 py-3">Entregable (30%)</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Observación</th>
                  {esStaff && <th className="px-4 py-3 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {examenesQuery.isLoading ? (
                  <tr>
                    <td colSpan={esStaff ? 9 : 7} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-5/6" />
                      <Spinner label="Cargando exámenes..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  examenesQuery.data?.map((ex) => {
                  const alumno = alumnosById.get(ex.alumno_id);
                  const isConfirming =
                    confirmDelete?.tipo === 'examen' && confirmDelete.id === ex.id;
                  return (
                    <tr key={ex.id}>
                      {esStaff && (
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {alumno?.nombre ?? ex.alumno_id}
                        </td>
                      )}
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        Examen {ex.hito}
                        {ex.es_recuperatorio ? ' (Recup.)' : ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{ex.nota_oral ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{ex.nota_live ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{ex.nota_entregable ?? '—'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-[var(--text-primary)]">
                        {ex.nota_final}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ESTADO_EXAMEN_BADGE[ex.estado]}>{ex.estado}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {ex.observacion ?? '—'}
                      </td>
                      {esStaff && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deleteExamenMutation.isPending}
                                onClick={() => deleteExamenMutation.mutate(ex.id)}
                                className="rounded-md border border-[var(--status-err-border)] bg-[var(--status-err-bg)] px-2 py-1 text-xs font-medium text-[var(--status-err-fg)] hover:opacity-90 disabled:opacity-50"
                              >
                                {deleteExamenMutation.isPending ? 'Borrando...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFeedback(null);
                                setConfirmDelete({ tipo: 'examen', id: ex.id });
                              }}
                              title="Eliminar examen"
                              aria-label="Eliminar examen"
                              className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--status-err-border)] hover:bg-[var(--status-err-bg)] hover:text-[var(--status-err-fg)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
                )}
                {!examenesQuery.isLoading && (!examenesQuery.data || examenesQuery.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={esStaff ? 9 : 7}
                      className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]"
                    >
                      Todavía no hay exámenes cargados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COHORTE (SOLO STAFF) */}
      {tab === 'alumnos' && esStaff && (
        <div className="space-y-6">
          {esAdmin && (
            <form
              onSubmit={handleCreateAlumno}
              className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:grid-cols-6"
            >
              <input
                required
                minLength={2}
                maxLength={80}
                placeholder="Nombre completo *"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />
              <input
                required
                type="email"
                maxLength={120}
                placeholder="Email *"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />
              <input
                required
                maxLength={39}
                placeholder="Usuario GitHub *"
                value={newGithub}
                onChange={(e) => setNewGithub(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />
              <select
                value={newRol}
                onChange={(e) => setNewRol(e.target.value as RolUsuario)}
                className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option value="estudiante">Estudiante</option>
                <option value="profesor">Profesor</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={newEsAdmin}
                  onChange={(e) => setNewEsAdmin(e.target.checked)}
                />
                Es Admin
              </label>
              <Button type="submit" size="sm" disabled={createAlumnoMutation.isPending}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </form>
          )}

          {esAdmin && editAlumnoId && (
            <form
              onSubmit={handleSaveAlumnoEdit}
              className="space-y-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Editar usuario y MVP
                  </p>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    {editAlNombre} (@{editAlGithub})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditAlumnoId(null)}
                  aria-label="Cerrar editor de usuario"
                  className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Nombre *</span>
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={editAlNombre}
                    onChange={(e) => setEditAlNombre(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Usuario GitHub *</span>
                  <input
                    required
                    maxLength={39}
                    value={editAlGithub}
                    onChange={(e) => setEditAlGithub(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 font-mono text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Rol</span>
                  <select
                    value={editAlRol}
                    onChange={(e) => setEditAlRol(e.target.value as RolUsuario)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="estudiante">Estudiante</option>
                    <option value="profesor">Profesor</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Estado</span>
                  <select
                    value={editAlEstado}
                    onChange={(e) => setEditAlEstado(e.target.value as EstadoAlumno)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="activo">activo</option>
                    <option value="atrasado">atrasado</option>
                    <option value="baja">baja</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Título MVP (opcional)</span>
                  <input
                    type="text"
                    placeholder="Ej: Turnos Barbería"
                    value={editAlMvpTitulo}
                    onChange={(e) => setEditAlMvpTitulo(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>URL App desplegada (opcional)</span>
                  <input
                    type="url"
                    placeholder="https://mi-mvp.vercel.app"
                    value={editAlMvpUrl}
                    onChange={(e) => setEditAlMvpUrl(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>URL Repo MVP (opcional)</span>
                  <input
                    type="url"
                    placeholder="https://github.com/usuario/mi-mvp"
                    value={editAlMvpRepoUrl}
                    onChange={(e) => setEditAlMvpRepoUrl(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                  />
                </label>

                <label className="flex items-center gap-2 self-end pb-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={perfil?.id === editAlumnoId ? true : editAlEsAdmin}
                    disabled={perfil?.id === editAlumnoId}
                    onChange={(e) => setEditAlEsAdmin(e.target.checked)}
                  />
                  Es Admin {perfil?.id === editAlumnoId && '(tu cuenta)'}
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditAlumnoId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateAlumnoMutation.isPending}
                >
                  {updateAlumnoMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">GitHub</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Vinculado Auth</th>
                  <th className="px-4 py-3">Estado</th>
                  {esAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {alumnosQuery.isLoading ? (
                  <tr>
                    <td colSpan={esAdmin ? 6 : 5} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-4/5" />
                      <Spinner label="Cargando cohorte..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  alumnos.map((a) => {
                    const isSelf = perfil?.id === a.id;
                    const isConfirming =
                      confirmDelete?.tipo === 'alumno' && confirmDelete.id === a.id;
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[var(--text-primary)]">{a.nombre}</p>
                          <p className="text-xs text-[var(--text-muted)]">{a.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          @{a.github_username}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="neutral">{a.rol}</Badge>
                            {a.es_admin && <Badge variant="success">admin</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={a.user_id ? 'success' : 'warning'}>
                            {a.user_id ? 'Activo' : 'Pendiente registro'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                          {esAdmin ? (
                            <select
                              aria-label={`Estado de ${a.nombre}`}
                              value={a.estado}
                              disabled={updateAlumnoEstadoMutation.isPending}
                              onChange={(e) =>
                                updateAlumnoEstadoMutation.mutate({
                                  id: a.id,
                                  estado: e.target.value as EstadoAlumno,
                                })
                              }
                              className="rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)]"
                            >
                              <option value="activo">activo</option>
                              <option value="atrasado">atrasado</option>
                              <option value="baja">baja</option>
                            </select>
                          ) : (
                            a.estado
                          )}
                        </td>
                        {esAdmin && (
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deleteAlumnoMutation.isPending}
                                  onClick={() => deleteAlumnoMutation.mutate(a.id)}
                                  className="rounded-md border border-[var(--status-err-border)] bg-[var(--status-err-bg)] px-2 py-1 text-xs font-medium text-[var(--status-err-fg)] hover:opacity-90 disabled:opacity-50"
                                >
                                  {deleteAlumnoMutation.isPending ? 'Borrando...' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(null)}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditAlumno(a)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Editar
                                </Button>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFeedback(null);
                                      setConfirmDelete({ tipo: 'alumno', id: a.id });
                                    }}
                                    title={`Eliminar a ${a.nombre}`}
                                    aria-label={`Eliminar a ${a.nombre}`}
                                    className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--status-err-border)] hover:bg-[var(--status-err-bg)] hover:text-[var(--status-err-fg)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
