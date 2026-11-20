import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { useAuthInit } from './hooks/useAuthInit';
import { ClasesPage } from './pages/ClasesPage';
import { EvaluadorPRsPage } from './pages/EvaluadorPRsPage';
import { HomePage } from './pages/HomePage';
import { LibretaPage } from './pages/LibretaPage';
import { LoginPage } from './pages/LoginPage';
import { PerfilPage } from './pages/PerfilPage';
import { PRDiffPage } from './pages/PRDiffPage';
import { ProyectosPage } from './pages/ProyectosPage';

export function App() {
  useAuthInit();

  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
  );
}
