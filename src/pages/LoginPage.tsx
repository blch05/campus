import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormField';
import { BRAND_NAME } from '../lib/brand';
import { formatAppError, parseAppError, type AppError } from '../lib/errors';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

type ModoAuth = 'login' | 'registro' | 'recuperar';

interface FieldErrors {
  nombre?: string;
  githubUsername?: string;
  email?: string;
  password?: string;
}

const GITHUB_USER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

export function LoginPage() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const [modo, setModo] = useState<ModoAuth>('login');
  const [nombre, setNombre] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [appError, setAppError] = useState<AppError | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Rate limit / cooldown en cliente tras varios intentos fallidos
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};
    const cleanEmail = email.trim();

    if (modo === 'registro') {
      const cleanNombre = nombre.trim();
      if (!cleanNombre) {
        errors.nombre = 'El nombre es obligatorio.';
      } else if (cleanNombre.length < 2) {
        errors.nombre = 'Ingresá al menos 2 caracteres.';
      } else if (cleanNombre.length > 80) {
        errors.nombre = 'Máximo 80 caracteres.';
      }

      const cleanGh = githubUsername.trim().replace(/^@/, '');
      if (!cleanGh) {
        errors.githubUsername = 'El usuario de GitHub es obligatorio.';
      } else if (!GITHUB_USER_REGEX.test(cleanGh)) {
        errors.githubUsername = 'Solo letras, números y guiones (1 a 39 caracteres, sin @).';
      }
    }

    if (!cleanEmail) {
      errors.email = 'El correo electrónico es obligatorio.';
    } else if (!EMAIL_REGEX.test(cleanEmail)) {
      errors.email = 'Ingresá un correo electrónico válido.';
    }

    if (modo !== 'recuperar') {
      if (!password) {
        errors.password = 'La contraseña es obligatoria.';
      } else if (password.length < 6) {
        errors.password = 'Mínimo 6 caracteres.';
      }
    }

    return errors;
  }

  function registerFailure(err: AppError) {
    setAppError(err);
    const next = failedAttempts + 1;
    if (next >= MAX_ATTEMPTS) {
      setFailedAttempts(0);
      setCooldownLeft(COOLDOWN_SECONDS);
    } else {
      setFailedAttempts(next);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cooldownLeft > 0) return;

    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setAppError({
        code: 'VAL_FORM_INVALID',
        message: 'Revisá los campos marcados en rojo antes de continuar.',
      });
      return;
    }

    if (!supabase) {
      setAppError({
        code: 'CFG_SUPABASE_MISSING',
        message: 'Supabase no está configurado en .env.',
      });
      return;
    }

    setSubmitting(true);
    setAppError(null);
    setInfoMsg(null);

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        setFailedAttempts(0);
      } else if (modo === 'recuperar') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/perfil`,
        });
        if (error) throw error;
        setFailedAttempts(0);
        setInfoMsg(
          'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada o spam.',
        );
        setModo('login');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              nombre: nombre.trim(),
              github_username: githubUsername.trim().toLowerCase().replace(/^@/, ''),
            },
          },
        });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          registerFailure({
            code: 'AUTH_DUPLICATE_EMAIL',
            message: 'Ese correo ya está registrado. Iniciá sesión con tu contraseña.',
          });
          setFieldErrors({ email: 'Este correo ya tiene una cuenta.' });
          return;
        }
        setFailedAttempts(0);
        setInfoMsg(
          '¡Cuenta creada! Revisá tu correo si te pide confirmación, o iniciá sesión directamente con tu contraseña.',
        );
        setModo('login');
      }
    } catch (err) {
      registerFailure(parseAppError(err));
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
          {modo === 'login'
            ? 'Iniciar sesión'
            : modo === 'registro'
              ? 'Crear cuenta'
              : 'Recuperar contraseña'}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {modo === 'login'
            ? 'Ingresá con tu correo y contraseña.'
            : modo === 'registro'
              ? 'Los campos marcados con * son obligatorios.'
              : 'Ingresá tu correo y te enviamos un enlace para cambiar tu contraseña.'}
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-md border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-3 text-xs text-[var(--status-warn-fg)]">
            [CFG_ENV] Faltan <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en{' '}
            <code>.env</code>.
          </div>
        )}

        {appError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-[var(--status-err-border)] bg-[var(--status-err-bg)] p-3 text-xs text-[var(--status-err-fg)]"
          >
            <span className="font-mono font-semibold">[{appError.code}]</span> {appError.message}
          </div>
        )}

        {cooldownLeft > 0 && (
          <div className="mt-3 rounded-md border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] p-3 text-xs text-[var(--status-warn-fg)]">
            [CLIENT_RATE_LIMIT] Demasiados intentos fallidos. Esperá{' '}
            <strong className="font-mono">{cooldownLeft}s</strong> para reintentar.
          </div>
        )}

        {infoMsg && (
          <div className="mt-4 rounded-md border border-[var(--status-ok-border)] bg-[var(--status-ok-bg)] p-3 text-xs text-[var(--status-ok-fg)]">
            {infoMsg}
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
          {modo === 'registro' && (
            <>
              <FormInput
                id="nombre"
                label="Nombre completo"
                required
                showCount
                maxLength={80}
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setFieldErrors((p) => ({ ...p, nombre: undefined }));
                }}
                placeholder="Tu nombre y apellido"
                error={fieldErrors.nombre}
              />

              <div>
                <FormInput
                  id="github"
                  label="Usuario de GitHub"
                  required
                  showCount
                  maxLength={39}
                  value={githubUsername}
                  onChange={(e) => {
                    setGithubUsername(e.target.value);
                    setFieldErrors((p) => ({ ...p, githubUsername: undefined }));
                  }}
                  placeholder="tu-usuario-github"
                  error={fieldErrors.githubUsername}
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Tiene que coincidir exactamente con tu cuenta de GitHub (se usa para tus entregas).
                </p>
              </div>
            </>
          )}

          <FormInput
            id="email"
            label="Correo electrónico"
            type="email"
            required
            maxLength={120}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            placeholder="tu-email@ejemplo.com"
            error={fieldErrors.email}
          />

          {modo !== 'recuperar' && (
            <FormInput
              id="password"
              label="Contraseña"
              type="password"
              required
              maxLength={72}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              placeholder="Mínimo 6 caracteres"
              error={fieldErrors.password}
            />
          )}

          {modo === 'login' && (
            <div className="-mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setModo('recuperar');
                  setAppError(null);
                  setInfoMsg(null);
                  setFieldErrors({});
                }}
                className="text-xs text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !isSupabaseConfigured || cooldownLeft > 0}
            className="w-full"
          >
            {submitting
              ? 'Procesando...'
              : cooldownLeft > 0
                ? `Esperá ${cooldownLeft}s...`
                : modo === 'login'
                  ? 'Entrar al Campus'
                  : modo === 'registro'
                    ? 'Crear cuenta'
                    : 'Enviar enlace de recuperación'}
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
                  setAppError(null);
                  setFieldErrors({});
                }}
                className="font-medium text-[var(--text-primary)] underline underline-offset-2"
              >
                Creá tu cuenta
              </button>
            </>
          ) : (
            <>
              ¿Ya tenés cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setModo('login');
                  setAppError(null);
                  setFieldErrors({});
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

export { formatAppError };
