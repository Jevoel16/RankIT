import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import ProtectedRouter from './components/ProtectedRouter';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import LoginPage from './pages/LoginPage';
import TallierPage from './pages/TallierPage';
import TabulatorPage from './pages/TabulatorPage';
import AdminPage from './pages/AdminPage';
import SuperadminPage from './pages/SuperadminPage';
import CommunityHome from './pages/CommunityHome';
import GrievancePage from './pages/GrievancePage';

function App() {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const homePath =
    user?.role === 'tallier'
      ? '/tallier'
      : user?.role === 'tabulator'
        ? '/tabulator'
        : user?.role === 'grievancecommittee'
          ? '/grievance'
        : user?.role === 'superadmin'
          ? '/superadmin'
          : '/admin';

  return (
    <div className="app-shell">
      <button
        type="button"
        className="theme-icon-btn"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Zm0 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-5a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1ZM6 12a1 1 0 0 1-1 1H4a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm10.95 4.536 0-.001.707.707a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 0 1 1.414-1.414ZM7.464 7.05a1 1 0 0 1 0 1.414l-.707.707A1 1 0 1 1 5.343 7.757l.707-.707a1 1 0 0 1 1.414 0Zm10.486 0a1 1 0 0 1 1.414 0l.707.707a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 0 1 0-1.414ZM7.464 16.95a1 1 0 0 1 1.414 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M14.768 3.96a1 1 0 0 1 .96 1.28A7 7 0 1 0 18.76 14a1 1 0 0 1 1.281.96A9 9 0 1 1 14.768 3.96Z" />
          </svg>
        )}
      </button>
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
            path="/tally/:eventId"
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
            path="/tabulate/:eventId"
            element={
              <ProtectedRouter roles={['tabulator']}>
                <TabulatorPage />
              </ProtectedRouter>
            }
          />
          <Route
            path="/grievance"
            element={
              <ProtectedRouter roles={['grievancecommittee']}>
                <GrievancePage />
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
