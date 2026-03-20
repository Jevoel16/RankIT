import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import ProtectedRouter from './components/ProtectedRouter';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import TallierPage from './pages/TallierPage';
import TabulatorPage from './pages/TabulatorPage';
import AdminPage from './pages/AdminPage';
import SuperadminPage from './pages/SuperadminPage';
import CommunityHome from './pages/CommunityHome';

function App() {
  const { isAuthenticated, user } = useAuth();
  const homePath =
    user?.role === 'tallier'
      ? '/tallier'
      : user?.role === 'tabulator'
        ? '/tabulator'
        : user?.role === 'superadmin'
          ? '/superadmin'
          : '/admin';

  return (
    <div className="app-shell">
      {isAuthenticated && <Navbar />}
      <main className="content-shell">
        <Routes>
          <Route path="/" element={<CommunityHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/tallier"
            element={
              <ProtectedRouter roles={['tallier']}>
                <TallierPage />
              </ProtectedRouter>
            }
          />
          <Route
            path="/tabulator"
            element={
              <ProtectedRouter roles={['tabulator']}>
                <TabulatorPage />
              </ProtectedRouter>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRouter roles={['admin']}>
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
          <Route path="*" element={<Navigate to={isAuthenticated ? homePath : '/'} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
