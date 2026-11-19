import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ClasesPage } from './pages/ClasesPage';
import { EvaluadorPRsPage } from './pages/EvaluadorPRsPage';
import { HomePage } from './pages/HomePage';
import { LibretaPage } from './pages/LibretaPage';
import { ProyectosPage } from './pages/ProyectosPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="clases" element={<ClasesPage />} />
          <Route path="evaluador" element={<EvaluadorPRsPage />} />
          <Route path="libreta" element={<LibretaPage />} />
          <Route path="proyectos" element={<ProyectosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
