import { useQuery } from '@tanstack/react-query';
import { Badge } from '../components/ui/Badge';
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
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Libreta y Cronograma
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Conectado a Supabase (entregas semanales y exámenes eliminatorios 30 % oral / 40 % live
          coding / 30 % entregable).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-canvas)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Clase / Semana</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Acceso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {clasesQuery.data?.map((clase) => (
              <tr key={clase.id}>
                <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                  {String(clase.numero).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{clase.titulo}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">Fase {clase.fase}</td>
                <td className="px-4 py-3">
                  <Badge variant={clase.desbloqueada ? 'success' : 'neutral'}>
                    {clase.desbloqueada ? 'Desbloqueada' : 'Bloqueada'}
                  </Badge>
                </td>
              </tr>
            ))}
            {(!clasesQuery.data || clasesQuery.data.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  {isSupabaseConfigured
                    ? 'No se encontraron clases cargadas.'
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
