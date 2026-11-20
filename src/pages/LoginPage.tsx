import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { BRAND_NAME } from '../lib/brand';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

type ModoAuth = 'login' | 'registro';

export function LoginPage() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const [modo, setModo] = useState<ModoAuth>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setErrorMsg('Supabase no está configurado en .env.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setInfoMsg(
          'Cuenta creada. Si tenés confirmación por correo activa en Supabase, revisá tu bandeja de entrada; si no, ya podés iniciar sesión.',
        );
        setModo('login');
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 text-[var(--text-primary)]">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {BRAND_NAME}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {modo === 'login' ? 'Iniciar sesión' : 'Activar tu cuenta'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {modo === 'login'
            ? 'Ingresá con el email registrado en la cohorte.'
            : 'Usá el mismo email que le pasaste al instructor para vincular tu perfil.'}
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-md border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-3 text-xs text-[var(--status-warn-fg)]">
            Faltan <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en{' '}
            <code>.env</code>.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-md border border-[var(--status-err-border)] bg-[var(--status-err-bg)] p-3 text-xs text-[var(--status-err-fg)]">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mt-4 rounded-md border border-[var(--status-ok-border)] bg-[var(--status-ok-bg)] p-3 text-xs text-[var(--status-ok-fg)]">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-[var(--text-primary)]">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-email@ejemplo.com"
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-[var(--text-primary)]">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !isSupabaseConfigured}
            className="w-full"
          >
            {submitting
              ? 'Procesando...'
              : modo === 'login'
                ? 'Entrar al Campus'
                : 'Crear contraseña'}
          </Button>
        </form>

        <div className="mt-5 text-center text-xs text-[var(--text-secondary)]">
          {modo === 'login' ? (
            <>
              ¿Primera vez entrando?{' '}
              <button
                type="button"
                onClick={() => {
                  setModo('registro');
                  setErrorMsg(null);
                }}
                className="font-medium text-[var(--text-primary)] underline underline-offset-2"
              >
                Activá tu cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setModo('login');
                  setErrorMsg(null);
                }}
                className="font-medium text-[var(--text-primary)] underline underline-offset-2"
              >
                Iniciá sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
