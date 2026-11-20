import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui/Skeleton';
import { useAuthInit } from './hooks/useAuthInit';

const ClasesPage = lazy(() =>
  import('./pages/ClasesPage').then((m) => ({ default: m.ClasesPage })),
);
const EvaluadorPRsPage = lazy(() =>
  import('./pages/EvaluadorPRsPage').then((m) => ({ default: m.EvaluadorPRsPage })),
);
const HomePage = lazy(() =>
  import('./pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const LibretaPage = lazy(() =>
  import('./pages/LibretaPage').then((m) => ({ default: m.LibretaPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const PerfilPage = lazy(() =>
  import('./pages/PerfilPage').then((m) => ({ default: m.PerfilPage })),
);
const PRDiffPage = lazy(() =>
  import('./pages/PRDiffPage').then((m) => ({ default: m.PRDiffPage })),
);
const ProyectosPage = lazy(() =>
  import('./pages/ProyectosPage').then((m) => ({ default: m.ProyectosPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner label="Cargando módulo..." />
    </div>
  );
}

export function App() {
  useAuthInit();

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="clases" element={<ClasesPage />} />
            <Route
              path="evaluador"
              element={
                <ProtectedRoute requireStaff>
                  <EvaluadorPRsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="evaluador/:prNumber/diff"
              element={
                <ProtectedRoute requireStaff>
                  <PRDiffPage />
                </ProtectedRoute>
              }
            />
            <Route path="libreta" element={<LibretaPage />} />
            <Route path="proyectos" element={<ProyectosPage />} />
            <Route path="perfil" element={<PerfilPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
