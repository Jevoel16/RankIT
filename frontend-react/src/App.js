import { Navigate, Route, Routes } from 'react-router-dom';
import './styles/tokens.css';
import './App.css';
import './styles/ui.css';
import './styles/responsive.css';
import './styles/print.css';
import AppShell from './components/AppShell.jsx';
import ProtectedRouter from './components/ProtectedRouter.jsx';
import { useAuth } from './hooks/useAuth';
import { homePathForRole } from './utils/roles';
import LoginPage from './pages/LoginPage.jsx';
import TabulatorPage from './pages/TabulatorPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SuperadminPage from './pages/SuperadminPage.jsx';
import CommunityHome from './pages/CommunityHome.jsx';
import GrievancePage from './pages/GrievancePage.jsx';

function App() {
  const { isAuthenticated, user } = useAuth();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<CommunityHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/tabulator"
          element={
            <ProtectedRouter roles={['tabulator']}>
              <TabulatorPage />
            </ProtectedRouter>
          }
        />
        <Route
          path="/tabulate/:eventId"
          element={
            <ProtectedRouter roles={['tabulator']}>
              <TabulatorPage />
            </ProtectedRouter>
          }
        />
        <Route path="/tallier" element={<Navigate to="/tabulator" replace />} />
        <Route path="/tallier/:eventId" element={<Navigate to="/tabulator" replace />} />
        <Route
          path="/grievance"
          element={
            <ProtectedRouter roles={['grievance']}>
              <GrievancePage />
            </ProtectedRouter>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRouter roles={['admin', 'superadmin']}>
              <AdminPage />
            </ProtectedRouter>
          }
        />
        <Route
          path="/superadmin"
          element={
            <ProtectedRouter roles={['superadmin']}>
              <SuperadminPage />
            </ProtectedRouter>
          }
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? homePathForRole(user?.role) : '/'} replace />}
        />
      </Routes>
    </AppShell>
  );
}

export default App;
