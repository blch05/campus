# Campus Web — Bootcamp Web TS

Aplicación web modular y reutilizable (React + TypeScript + Tailwind CSS + TanStack Query + Zustand + Supabase) que se alimenta del repositorio público del curso (`curso-repo`) mediante la **GitHub REST API** y gestiona cohortes, notas y entregas en **Supabase**.

## Módulos principales

1. **Portal de Clases y Docs (`/clases`):** Lee `clases/` y `docs/` desde el repositorio configurado (`VITE_GITHUB_OWNER`/`VITE_GITHUB_REPO`), renderiza consignas Markdown y enlaza descargas de presentaciones.
2. **Evaluador de PRs (`/evaluador`):** Lista los Pull Requests abiertos de la cohorte, valida el **Guardián de Rutas** (`entregas/<autor>/`), muestra la declaración de uso de IA y filtra el diff limpio del código modificado.
3. **Libreta de Notas (`/libreta`):** Gestión de alumnos, entregas semanales y exámenes eliminatorios (30 % oral / 40 % live coding / 30 % entregable, nota mínima `>= 7`).
4. **Proyectos de la Cohorte (`/proyectos`):** Galería pública de los MVPs desplegados por los egresados.

## Configuración local

1. Copiá `.env.example` a `.env` y completá las variables de Supabase y GitHub.
2. Ejecutá [`supabase/schema.sql`](./supabase/schema.sql) en el **SQL Editor** de tu proyecto Supabase.
3. Instalá dependencias y levantá el servidor de desarrollo:

```bash
npm install
npm run dev
```

## Estructura de carpetas

```text
campus/
├── supabase/
│   └── schema.sql            # Tablas, RLS, vista pública y seed de 13 clases
├── src/
│   ├── components/layout/    # Shell de navegación y layout
│   ├── lib/                  # Clientes de Supabase y GitHub REST API
│   ├── pages/                # Inicio, Clases, Evaluador PRs, Libreta, Proyectos
│   ├── store/                # Estado global de cliente (Zustand)
│   └── types/                # Contratos TypeScript (BD + GitHub)
├── .env.example
└── package.json
```
