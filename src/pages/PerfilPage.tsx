import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Moon, Shield, Sun } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormField';
import { Skeleton } from '../components/ui/Skeleton';
import { formatAppError, parseAppError } from '../lib/errors';
import { githubConfig, isGitHubConfigured } from '../lib/github';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import type { Entrega, Examen } from '../types/database';

export function PerfilPage() {
  const user = useAuthStore((s) => s.user);
  const perfil = useAuthStore((s) => s.perfil);
  const perfilLoading = useAuthStore((s) => s.perfilLoading);
  const signOut = useAuthStore((s) => s.signOut);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwFeedback, setPwFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const entregasQuery = useQuery({
    queryKey: ['supabase', 'entregas', 'self', perfil?.id],
    enabled: isSupabaseConfigured && Boolean(perfil?.id),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('entregas')
        .select('*')
        .eq('alumno_id', perfil!.id);
      if (error) throw error;
      return (data ?? []) as Entrega[];
    },
  });

  const examenesQuery = useQuery({
    queryKey: ['supabase', 'examenes', 'self', perfil?.id],
    enabled: isSupabaseConfigured && Boolean(perfil?.id),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('examenes')
        .select('*')
        .eq('alumno_id', perfil!.id);
      if (error) throw error;
      return (data ?? []) as Examen[];
    },
  });

  const entregas = entregasQuery.data ?? [];
  const aprobadas = entregas.filter((e) => e.estado === 'aprobada').length;
  const examenesEvaluados = (examenesQuery.data ?? []).filter((ex) => ex.estado !== 'pendiente');
  const promedio =
    examenesEvaluados.length > 0
      ? Math.round(
          (examenesEvaluados.reduce((acc, ex) => acc + Number(ex.nota_final || 0), 0) /
            examenesEvaluados.length) *
            100,
        ) / 100
      : null;

  const entregasFolderUrl =
    isGitHubConfigured && perfil
      ? `https://github.com/${githubConfig.owner}/${githubConfig.repo}/tree/main/entregas/${perfil.github_username}`
      : null;

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwFeedback(null);

    if (newPassword.length < 6) {
      setPwError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas no coinciden.');
      return;
    }
    if (!supabase) return;

    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setPwFeedback({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
    } catch (err) {
      setPwFeedback({ type: 'error', text: formatAppError(parseAppError(err)) });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Mi Perfil
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Datos de tu cuenta, resumen académico y preferencias de interfaz.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>

      {/* Identidad */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Identidad y Rol
        </h2>

        {perfilLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Nombre</p>
              <p className="mt-0.5 font-medium text-[var(--text-primary)]">
                {perfil?.nombre ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Correo electrónico</p>
              <p className="mt-0.5 font-medium text-[var(--text-primary)]">
                {perfil?.email ?? user?.email ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">GitHub</p>
              <div className="mt-0.5 flex items-center gap-3">
                <a
                  href={perfil ? `https://github.com/${perfil.github_username}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-[var(--text-primary)] underline underline-offset-2"
                >
                  @{perfil?.github_username ?? '—'} <ExternalLink className="h-3 w-3" />
                </a>
                {entregasFolderUrl && (
                  <a
                    href={entregasFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Mi carpeta entregas/ ↗
                  </a>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Rol y Estado</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="neutral">{perfil?.rol ?? 'sin rol'}</Badge>
                {perfil?.es_admin && (
                  <Badge variant="success">
                    <Shield className="h-3 w-3" /> Admin
                  </Badge>
                )}
                {perfil && (
                  <Badge variant={perfil.estado === 'activo' ? 'success' : 'warning'}>
                    {perfil.estado}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Resumen Académico */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Resumen Académico
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
            <p className="text-xs text-[var(--text-secondary)]">Entregas aprobadas</p>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--text-primary)]">
              {aprobadas} / {entregas.length}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-canvas)] p-4">
            <p className="text-xs text-[var(--text-secondary)]">Promedio de exámenes</p>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--text-primary)]">
              {promedio !== null ? `${promedio.toFixed(2)} / 10` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Proyecto Integrador (MVP) */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Proyecto Integrador (MVP)
        </h2>
        {perfil?.mvp_titulo || perfil?.mvp_url ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-[var(--text-primary)]">
              {perfil.mvp_titulo ?? 'Proyecto sin título'}
            </p>
            <div className="flex flex-wrap gap-4 text-xs">
              {perfil.mvp_url && (
                <a
                  href={perfil.mvp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  App en producción <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {perfil.mvp_repo_url && (
                <a
                  href={perfil.mvp_repo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Repositorio <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            A partir de la Semana 4 vas a definir tu MVP y en la Semana 11 aparecerán acá tus links
            de producción y repositorio.
          </p>
        )}
      </section>

      {/* Apariencia y Seguridad */}
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Apariencia
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Tema actual:{' '}
            <strong className="text-[var(--text-primary)]">
              {theme === 'light' ? 'Modo Claro (#FFFFFF)' : 'Modo Oscuro OLED (#000000)'}
            </strong>
          </p>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {theme === 'light' ? (
              <>
                <Moon className="h-3.5 w-3.5" /> Cambiar a OLED Oscuro
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5" /> Cambiar a Claro
              </>
            )}
          </Button>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Seguridad
          </h2>
          {pwFeedback && (
            <div
              role={pwFeedback.type === 'error' ? 'alert' : 'status'}
              className={`rounded-md border px-3 py-2 text-xs ${
                pwFeedback.type === 'error'
                  ? 'border-[var(--status-err-border)] bg-[var(--status-err-bg)] text-[var(--status-err-fg)]'
                  : 'border-[var(--status-ok-border)] bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)]'
              }`}
            >
              {pwFeedback.text}
            </div>
          )}
          <form noValidate onSubmit={handlePasswordUpdate} className="space-y-3">
            <FormInput
              id="new-password"
              label="Nueva contraseña"
              type="password"
              required
              maxLength={72}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPwError(null);
              }}
              placeholder="Mínimo 6 caracteres"
              error={pwError ?? undefined}
            />
            <FormInput
              id="confirm-password"
              label="Repetir contraseña"
              type="password"
              required
              maxLength={72}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPwError(null);
              }}
              placeholder="Repetí la nueva contraseña"
            />
            <Button type="submit" variant="primary" size="sm" disabled={savingPw || !isSupabaseConfigured}>
              {savingPw ? 'Actualizando...' : 'Actualizar contraseña'}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
