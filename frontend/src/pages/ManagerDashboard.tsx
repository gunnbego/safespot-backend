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

type DashboardTileId = 'openHazards' | 'openIncidents' | 'highRiskHazards' | 'evidencePhotos' | 'resolvedIssues' | 'activeRegister';

const ALL_DASHBOARD_TILES: DashboardTileId[] = [
  'openHazards',
  'openIncidents',
  'highRiskHazards',
  'evidencePhotos',
  'resolvedIssues',
  'activeRegister'
];

const defaultTileIds: DashboardTileId[] = ['openHazards', 'openIncidents', 'highRiskHazards', 'evidencePhotos'];

const tileStorageKey = (userId?: string) => `safespot.dashboard.tiles.${userId ?? 'anonymous'}`;

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [customising, setCustomising] = useState(false);
  const [tileIds, setTileIds] = useState<DashboardTileId[]>(() => {
    const saved = window.localStorage.getItem(tileStorageKey(user?.id));
    if (!saved) return defaultTileIds;
    try {
      const parsed = JSON.parse(saved) as DashboardTileId[];
      const validTiles = parsed.filter((tile) => ALL_DASHBOARD_TILES.includes(tile));
      return validTiles.length ? validTiles : defaultTileIds;
    } catch {
      return defaultTileIds;
    }
  });

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
  const hazardCount = activeReports.filter((report) => report.category?.toLowerCase() === 'hazard').length;
  const incidentCount = activeReports.filter((report) => report.category?.toLowerCase() === 'incident').length;
  const highRiskCount = activeReports.filter(isHighRisk).length;
  const photoEvidenceCount = reports.reduce((total, report) => total + Number(report.photoCount ?? 0), 0);

  const tiles: Record<DashboardTileId, { label: string; value: number; detail: string; tone: string; href: string }> = {
    openHazards: {
      label: 'Open hazards',
      value: hazardCount,
      detail: `${highRiskCount} high risk`,
      tone: 'amber',
      href: '/team-audits?status=active&category=hazard'
    },
    openIncidents: {
      label: 'Open incidents',
      value: incidentCount,
      detail: 'Awaiting triage or closure',
      tone: 'red',
      href: '/team-audits?status=active&category=incident'
    },
    highRiskHazards: {
      label: 'High-risk hazards',
      value: highRiskCount,
      detail: 'Needs manager attention',
      tone: 'red',
      href: '/team-audits?status=active&severity=high-risk'
    },
    evidencePhotos: {
      label: 'Evidence photos',
      value: photoEvidenceCount,
      detail: 'Attached to reports',
      tone: 'blue',
      href: '/team-audits?photos=1'
    },
    resolvedIssues: {
      label: 'Resolved issues',
      value: reports.length - activeReports.length,
      detail: 'Closed with controls',
      tone: 'green',
      href: '/team-audits?status=closed'
    },
    activeRegister: {
      label: 'Active register',
      value: activeReports.length,
      detail: 'Hazards and incidents',
      tone: 'amber',
      href: '/team-audits?status=active'
    }
  };

  const visibleTileIds = ALL_DASHBOARD_TILES.filter((tileId) => tileIds.includes(tileId));

  const toggleTile = (tileId: DashboardTileId) => {
    const next = tileIds.includes(tileId)
      ? tileIds.filter((id) => id !== tileId)
      : [...tileIds, tileId];
    const ordered = ALL_DASHBOARD_TILES.filter((id) => next.includes(id));
    setTileIds(ordered);
    window.localStorage.setItem(tileStorageKey(user?.id), JSON.stringify(ordered));
  };

  return (
    <section className="dashboard-console">
      <div className="console-topbar">
        <div>
          <h1>Dashboard</h1>
          <p>Good evening, {user?.name}. Here is the WHS position across your company.</p>
        </div>
        <div className="button-row dashboard-actions">
          <button type="button" className="secondary-button" onClick={() => setCustomising((value) => !value)}>
            {customising ? 'Done' : 'Customise tiles'}
          </button>
          <Link className="primary-action" to="/submit">Create issue</Link>
        </div>
      </div>

      {customising && <div className="dashboard-panel tile-picker">
        <h2>Dashboard tiles</h2>
        <div className="tile-toggle-grid">
          {ALL_DASHBOARD_TILES.map((tileId) => (
            <label key={tileId}>
              <input
                type="checkbox"
                checked={tileIds.includes(tileId)}
                onChange={() => toggleTile(tileId)}
              />
              {tiles[tileId].label}
            </label>
          ))}
        </div>
      </div>}

      <div className="metric-grid">
        {visibleTileIds.map((tileId) => {
          const tile = tiles[tileId];
          return (
          <Link key={tileId} to={tile.href} className={`metric-card ${tile.tone}`}>
            <span>{tile.label}</span>
            <strong>{loading ? '-' : tile.value}</strong>
            <p>{tile.detail}</p>
          </Link>
          );
        })}
        {!visibleTileIds.length && (
          <div className="empty-state">Choose at least one dashboard tile above.</div>
        )}
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
