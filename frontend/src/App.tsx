import { Navigate, Route, Routes, Link, NavLink } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MemberDashboard from './pages/MemberDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import SubmitAuditPage from './pages/SubmitAuditPage';
import MyAuditsPage from './pages/MyAuditsPage';
import TeamMembersPage from './pages/TeamMembersPage';
import TeamAuditsPage from './pages/TeamAuditsPage';
import AuditDetailPage from './pages/AuditDetailPage';
import AccountSettingsPage from './pages/AccountSettingsPage';

const App = () => {
  const { user, logout } = useAuth();
  const isManager = user?.role === 'manager';

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="logo" aria-label="SafeSpot dashboard">
          <span className="logo-mark">S</span>
          <span>
            SafeSpot
            <small>WHS OPERATIONS</small>
          </span>
        </Link>
        <nav className="side-nav">
          {user ? (
            <>
              <span className="nav-section">Operate</span>
              {isManager ? (
                <>
                  <NavLink to="/manager">Dashboard</NavLink>
                  <NavLink to="/team-audits">Hazard register</NavLink>
                  <NavLink to="/submit">Create issue</NavLink>
                  <NavLink to="/team">People & teams</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/member">Home</NavLink>
                  <NavLink to="/submit">Report issue</NavLink>
                  <NavLink to="/my-audits">My reports</NavLink>
                </>
              )}
              <span className="nav-section">Account</span>
              <NavLink to="/account">Settings</NavLink>
              <button className="link-button" onClick={logout}>Sign out</button>
            </>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </aside>

      <main className="app-content">
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/member" element={<RequireAuth><MemberDashboard /></RequireAuth>} />
          <Route path="/manager" element={<RequireAuth requiredRole="manager"><ManagerDashboard /></RequireAuth>} />
          <Route path="/submit" element={<RequireAuth><SubmitAuditPage /></RequireAuth>} />
          <Route path="/my-audits" element={<RequireAuth><MyAuditsPage /></RequireAuth>} />
          <Route path="/team" element={<RequireAuth requiredRole="manager"><TeamMembersPage /></RequireAuth>} />
          <Route path="/team-audits" element={<RequireAuth requiredRole="manager"><TeamAuditsPage /></RequireAuth>} />
          <Route path="/audit/:id" element={<RequireAuth><AuditDetailPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountSettingsPage /></RequireAuth>} />
          <Route path="/" element={<Navigate to={user ? (isManager ? '/manager' : '/member') : '/login'} />} />
          <Route path="*" element={<div className="page-card">Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
