import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../api/auditApi';
import { useAuth } from '../auth/AuthProvider';

interface SafetyReport {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  createdBy?: string;
  submittedBy?: string;
  createdAt?: string;
  resolvedBy?: string;
  photoCount?: number;
}

const isResolved = (report: SafetyReport) => report.status?.toLowerCase() === 'resolved';
const isHighRisk = (report: SafetyReport) => ['high', 'extreme', 'critical'].includes(report.severity?.toLowerCase());

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi
      .getTeamAudits()
      .then((data) => setReports(data))
      .finally(() => setLoading(false));
  }, []);

  const activeReports = useMemo(() => reports.filter((report) => !isResolved(report)), [reports]);
  const recentReports = useMemo(
    () => [...reports].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).slice(0, 5),
    [reports]
  );
  const hazardCount = reports.filter((report) => report.category?.toLowerCase() === 'hazard').length;
  const incidentCount = reports.filter((report) => report.category?.toLowerCase() === 'incident').length;
  const highRiskCount = activeReports.filter(isHighRisk).length;
  const photoEvidenceCount = reports.reduce((total, report) => total + Number(report.photoCount ?? 0), 0);

  const tiles = [
    { label: 'Open hazards', value: hazardCount, detail: `${highRiskCount} high risk`, tone: 'amber' },
    { label: 'Open incidents', value: incidentCount, detail: 'Awaiting triage or closure', tone: 'red' },
    { label: 'High-risk hazards', value: highRiskCount, detail: 'Needs manager attention', tone: 'red' },
    { label: 'Evidence photos', value: photoEvidenceCount, detail: 'Attached to reports', tone: 'blue' },
    { label: 'Resolved issues', value: reports.length - activeReports.length, detail: 'Closed with controls', tone: 'green' },
    { label: 'Active register', value: activeReports.length, detail: 'Hazards and incidents', tone: 'amber' }
  ];

  return (
    <section className="dashboard-console">
      <div className="console-topbar">
        <div>
          <h1>Dashboard</h1>
          <p>Good evening, {user?.name}. Here is the WHS position across your company.</p>
        </div>
        <Link className="primary-action" to="/submit">Create issue</Link>
      </div>

      <div className="dashboard-panel tile-picker">
        <h2>Dashboard tiles</h2>
        <div className="tile-toggle-grid">
          {tiles.slice(0, 4).map((tile) => (
            <label key={tile.label}>
              <input type="checkbox" checked readOnly />
              {tile.label}
            </label>
          ))}
        </div>
      </div>

      <div className="metric-grid">
        {tiles.map((tile) => (
          <article key={tile.label} className={`metric-card ${tile.tone}`}>
            <span>{tile.label}</span>
            <strong>{loading ? '-' : tile.value}</strong>
            <p>{tile.detail}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-split">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Recent observations</h2>
            <Link to="/team-audits">View all</Link>
          </div>
          {loading ? (
            <div className="empty-state">Loading safety reports...</div>
          ) : recentReports.length ? (
            <div className="compact-list">
              {recentReports.map((report) => (
                <Link key={report.id} to={`/audit/${report.id}`}>
                  <strong>{report.title}</strong>
                  <span>{report.category} · {report.severity} · {report.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">No hazards or incidents yet.</div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <h2>Management actions</h2>
          </div>
          <div className="action-list">
            <Link to="/team-audits">Review unresolved hazards</Link>
            <Link to="/team">Manage users and roles</Link>
            <Link to="/submit">Create a control or hazard</Link>
          </div>
        </section>
      </div>
    </section>
  );
};

export default ManagerDashboard;
