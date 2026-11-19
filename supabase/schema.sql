-- Schema inicial para el Campus del Bootcamp (Supabase / PostgreSQL)
-- Ejecutar en el SQL Editor de tu proyecto Supabase

-- 1. Perfiles / Usuarios de la plataforma (estudiantes, profesores + flag booleano independiente de administrador)
create table if not exists public.alumnos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  email text unique not null,
  github_username text unique not null,
  rol text not null default 'estudiante' check (rol in ('estudiante', 'profesor')),
  es_admin boolean not null default false,
  estado text not null default 'activo' check (estado in ('activo', 'atrasado', 'baja')),
  nota_excepcion text,
  mvp_titulo text,
  mvp_url text,
  mvp_repo_url text,
  mvp_api_url text,
  created_at timestamptz not null default now()
);

-- 2. Agenda de Clases (conecta el banner de "Próxima clase" y sincronización con Google Calendar)
create table if not exists public.clases (
  id serial primary key,
  numero integer unique not null, -- 0 = Clase 0, 1..12 = Semanas
  titulo text not null,
  fase integer not null check (fase between 0 and 3),
  carpeta_repo text not null, -- ej: 'clases/clase-00', 'clases/semana-01'
  fecha_programada timestamptz,
  duracion_hs numeric(3,1) default 2,
  modalidad text default '2 hs (Compacto)',
  link_llamada text,
  estado text not null default 'programada' check (estado in ('programada', 'reprogramada', 'dictada', 'cancelada')),
  nota_cambio text,
  gcal_event_id text
);

-- 3. Entregas semanales por estudiante (cruza PRs de GitHub + prórrogas/excepciones)
create table if not exists public.entregas (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  clase_numero integer not null references public.clases(numero) on delete cascade,
  pr_number integer,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_revision', 'aprobada', 'prorroga', 'desaprobada')),
  fecha_limite_override timestamptz,
  observacion text,
  updated_at timestamptz not null default now(),
  unique (alumno_id, clase_numero)
);

-- 4. Exámenes eliminatorios (Hitos 1, 2 y 3 — 30% oral, 40% live coding, 30% entregable)
create table if not exists public.examenes (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos(id) on delete cascade,
  hito integer not null check (hito in (1, 2, 3)),
  nota_oral numeric(4,2) check (nota_oral between 0 and 10),
  nota_live numeric(4,2) check (nota_live between 0 and 10),
  nota_entregable numeric(4,2) check (nota_entregable between 0 and 10),
  nota_final numeric(4,2) generated always as (
    round((coalesce(nota_oral,0) * 0.30 + coalesce(nota_live,0) * 0.40 + coalesce(nota_entregable,0) * 0.30)::numeric, 2)
  ) stored,
  es_recuperatorio boolean not null default false,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'recuperatorio', 'baja')),
  observacion text,
  updated_at timestamptz not null default now(),
  unique (alumno_id, hito, es_recuperatorio)
);

-- Trigger: vincular automáticamente auth.users -> public.alumnos por email al registrarse
create or replace function public.vincular_alumno_on_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.alumnos
  set user_id = new.id
  where lower(email) = lower(new.email)
    and user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vincular_alumno on auth.users;
create trigger on_auth_user_created_vincular_alumno
  after insert on auth.users
  for each row execute function public.vincular_alumno_on_auth_signup();

-- Habilitar Row Level Security (RLS)
alter table public.alumnos enable row level security;
alter table public.clases enable row level security;
alter table public.entregas enable row level security;
alter table public.examenes enable row level security;

-- Helpers de autorización
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.alumnos
    where user_id = auth.uid() and es_admin = true
  );
$$;

create or replace function public.es_profesor_o_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.alumnos
    where user_id = auth.uid() and (rol = 'profesor' or es_admin = true)
  );
$$;

-- Políticas RLS
-- Clases: cualquier usuario autenticado puede verlas; profesores y admins gestionan
create policy "clases_select_auth" on public.clases for select to authenticated using (true);
create policy "clases_staff_all" on public.clases for all to authenticated
  using (public.es_profesor_o_admin()) with check (public.es_profesor_o_admin());

-- Alumnos: cada usuario ve su perfil; profesores y admins ven todos; solo admin gestiona altas/bajas/roles
create policy "alumnos_select_self_or_staff" on public.alumnos for select to authenticated
  using (user_id = auth.uid() or public.es_profesor_o_admin());
create policy "alumnos_admin_all" on public.alumnos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Entregas: cada estudiante ve las suyas; profesores y admins gestionan todas
create policy "entregas_select_self_or_staff" on public.entregas for select to authenticated
  using (public.es_profesor_o_admin() or alumno_id in (select id from public.alumnos where user_id = auth.uid()));
create policy "entregas_staff_all" on public.entregas for all to authenticated
  using (public.es_profesor_o_admin()) with check (public.es_profesor_o_admin());

-- Exámenes: cada estudiante ve los suyos; profesores y admins gestionan todos
create policy "examenes_select_self_or_staff" on public.examenes for select to authenticated
  using (public.es_profesor_o_admin() or alumno_id in (select id from public.alumnos where user_id = auth.uid()));
create policy "examenes_staff_all" on public.examenes for all to authenticated
  using (public.es_profesor_o_admin()) with check (public.es_profesor_o_admin());

-- Vista segura para la galería de proyectos de la cohorte (SOLO para usuarios logueados, sin exponer emails ni notas)
create or replace view public.proyectos_cohorte as
select
  nombre,
  github_username,
  mvp_titulo,
  mvp_url,
  mvp_repo_url,
  mvp_api_url
from public.alumnos
where rol = 'estudiante' and estado <> 'baja' and mvp_url is not null;

revoke all on public.proyectos_cohorte from anon, public;
grant select on public.proyectos_cohorte to authenticated;

-- Seed inicial de las 13 clases (Clase 0 + Semanas 1 a 12)
insert into public.clases (numero, titulo, fase, carpeta_repo, estado) values
  (0,  'Clase 0 — Presentación, Entorno, HTML/CSS y Primer PR', 0, 'clases/clase-00', 'programada'),
  (1,  'Semana 1 — TypeScript: Tipos, Condicionales y Bucles', 1, 'clases/semana-01', 'programada'),
  (2,  'Semana 2 — Funciones Tipadas, Interfaces, Arrays y JSON', 1, 'clases/semana-02', 'programada'),
  (3,  'Semana 3 — HTTP, APIs REST y Asincronía', 1, 'clases/semana-03', 'programada'),
  (4,  'Semana 4 — Examen Eliminatorio 1 + Definición de MVP', 1, 'clases/semana-04', 'programada'),
  (5,  'Semana 5 — React + Vite + TypeScript + Tailwind', 2, 'clases/semana-05', 'programada'),
  (6,  'Semana 6 — Arquitectura de Bases de Datos Relacionales y SQL Puro', 2, 'clases/semana-06', 'programada'),
  (7,  'Semana 7 — Supabase, Custom Hooks y TanStack Query', 2, 'clases/semana-07', 'programada'),
  (8,  'Semana 8 — Examen Eliminatorio 2', 2, 'clases/semana-08', 'programada'),
  (9,  'Semana 9 — Autenticación, Roles, RLS y Zustand', 3, 'clases/semana-09', 'programada'),
  (10, 'Semana 10 — Backend Propio en Node.js + Express + JWT', 3, 'clases/semana-10', 'programada'),
  (11, 'Semana 11 — Emancipación del MVP, Deploy, Dominios y DNS', 3, 'clases/semana-11', 'programada'),
  (12, 'Semana 12 — Examen Final y Defensa del MVP', 3, 'clases/semana-12', 'programada')
on conflict (numero) do nothing;
