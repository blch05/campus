import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <div className="flex items-center gap-2 text-indigo-400">
          <GraduationCap className="h-7 w-7" />
          <span className="text-lg font-bold text-white">Campus Bootcamp Web TS</span>
        </div>

        <h1 className="mt-4 text-2xl font-bold text-white">
          {modo === 'login' ? 'Iniciar sesión' : 'Activar tu cuenta'}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {modo === 'login'
            ? 'Ingresá con el email registrado en la cohorte.'
            : 'Usá el mismo email que le pasaste al instructor para vincular tu perfil automáticamente.'}
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            Faltan <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en{' '}
            <code>.env</code>.
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-300">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-email@ejemplo.com"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-300">
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
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !isSupabaseConfigured}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? 'Procesando...'
              : modo === 'login'
                ? 'Entrar al Campus'
                : 'Crear contraseña'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-400">
          {modo === 'login' ? (
            <>
              ¿Primera vez entrando?{' '}
              <button
                type="button"
                onClick={() => {
                  setModo('registro');
                  setErrorMsg(null);
                }}
                className="font-medium text-indigo-400 hover:underline"
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
                className="font-medium text-indigo-400 hover:underline"
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
