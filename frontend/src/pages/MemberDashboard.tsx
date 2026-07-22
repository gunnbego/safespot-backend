import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const MemberDashboard = () => {
  const { user } = useAuth();

  return (
    <section className="dashboard-console member-console">
      <div className="console-topbar">
        <div>
          <h1>Safety home</h1>
          <p>Welcome back, {user?.name}. Report hazards and incidents as soon as you spot them.</p>
        </div>
        <Link className="primary-action" to="/submit">Report issue</Link>
      </div>
      <div className="metric-grid member-actions">
        <Link className="metric-card amber" to="/submit">
          <span>Create</span>
          <strong>Hazard</strong>
          <p>Add notes and photos for managers.</p>
        </Link>
        <Link className="metric-card red" to="/submit">
          <span>Create</span>
          <strong>Incident</strong>
          <p>Raise events that need review.</p>
        </Link>
        <Link className="metric-card blue" to="/my-audits">
          <span>Track</span>
          <strong>Reports</strong>
          <p>See the issues you have submitted.</p>
        </Link>
      </div>
    </section>
  );
};

export default MemberDashboard;
