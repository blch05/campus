import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Clase } from '../types/database';

export function LibretaPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Libreta de Notas y Cronograma</h1>
        <p className="mt-1 text-sm text-slate-400">
          Conectado a <code>supabase/schema.sql</code> (tablas <code>alumnos</code>,{' '}
          <code>clases</code>, <code>entregas</code> y <code>examenes</code> con fórmula 30 % oral
          / 40 % live coding / 30 % entregable).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Clase / Semana</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {clasesQuery.data?.map((clase) => (
              <tr key={clase.id}>
                <td className="px-4 py-3 font-mono text-slate-400">{clase.numero}</td>
                <td className="px-4 py-3 font-medium text-white">{clase.titulo}</td>
                <td className="px-4 py-3 text-slate-300">Fase {clase.fase}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-200">
                    {clase.estado}
                  </span>
                </td>
              </tr>
            ))}
            {(!clasesQuery.data || clasesQuery.data.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {isSupabaseConfigured
                    ? 'Iniciá sesión en Supabase para ver las clases y notas protegidas por RLS.'
                    : 'Configurá Supabase en .env y ejecutá supabase/schema.sql para habilitar la libreta.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
