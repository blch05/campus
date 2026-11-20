import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Unlock } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Skeleton, Spinner } from '../components/ui/Skeleton';
import { formatAppError, parseAppError } from '../lib/errors';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import type {
  Alumno,
  Clase,
  Entrega,
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

export function LibretaPage() {
  const queryClient = useQueryClient();
  const esStaff = useAuthStore((s) => s.esStaff)();
  const esAdmin = useAuthStore((s) => s.esAdmin)();

  const [tab, setTab] = useState<TabLibreta>('cronograma');

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

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

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

  const createAlumnoMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase!.from('alumnos').insert({
        nombre: newNombre.trim(),
        email: newEmail.trim().toLowerCase(),
        github_username: newGithub.trim().toLowerCase(),
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
    { id: 'examenes', label: 'Exámenes (30/40/30)', visible: true },
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
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Clase / Semana</th>
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Acceso</th>
                {esStaff && <th className="px-4 py-3 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {clasesQuery.isLoading ? (
                <tr>
                  <td colSpan={esStaff ? 5 : 4} className="space-y-2 px-4 py-6">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-11/12" />
                    <Skeleton className="h-5 w-4/5" />
                    <Spinner label="Cargando cronograma..." className="pt-1" />
                  </td>
                </tr>
              ) : (
                clasesQuery.data?.map((clase) => (
                <tr key={clase.id}>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    {String(clase.numero).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {clase.titulo}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">Fase {clase.fase}</td>
                  <td className="px-4 py-3">
                    <Badge variant={clase.desbloqueada ? 'success' : 'neutral'}>
                      {clase.desbloqueada ? 'Desbloqueada' : 'Bloqueada'}
                    </Badge>
                  </td>
                  {esStaff && (
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  )}
                </tr>
              ))
              )}
            </tbody>
          </table>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {entregasQuery.isLoading ? (
                  <tr>
                    <td colSpan={esStaff ? 5 : 4} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-5/6" />
                      <Spinner label="Cargando entregas..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  entregasQuery.data?.map((ent) => {
                  const alumno = alumnosById.get(ent.alumno_id);
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
                    </tr>
                  );
                })
                )}
                {!entregasQuery.isLoading && (!entregasQuery.data || entregasQuery.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={esStaff ? 5 : 4}
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
                placeholder="Live 40%"
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
                placeholder="Observación / devolución..."
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
                  <th className="px-4 py-3">Live (40%)</th>
                  <th className="px-4 py-3">Entregable (30%)</th>
                  <th className="px-4 py-3">Final</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {examenesQuery.isLoading ? (
                  <tr>
                    <td colSpan={esStaff ? 7 : 6} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-5/6" />
                      <Spinner label="Cargando exámenes..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  examenesQuery.data?.map((ex) => {
                  const alumno = alumnosById.get(ex.alumno_id);
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
                    </tr>
                  );
                })
                )}
                {!examenesQuery.isLoading && (!examenesQuery.data || examenesQuery.data.length === 0) && (
                  <tr>
                    <td
                      colSpan={esStaff ? 7 : 6}
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

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">GitHub</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Vinculado Auth</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {alumnosQuery.isLoading ? (
                  <tr>
                    <td colSpan={5} className="space-y-2 px-4 py-6">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-5 w-4/5" />
                      <Spinner label="Cargando cohorte..." className="pt-1" />
                    </td>
                  </tr>
                ) : (
                  alumnos.map((a) => (
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
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{a.estado}</td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
