import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../api/auditApi';
import AuditCard from '../components/AuditCard';

interface Audit {
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

const TeamAuditsPage = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [query, setQuery] = useState('');

  useEffect(() => {
    auditApi
      .getTeamAudits()
      .then((data) => setAudits(data))
      .finally(() => setLoading(false));
  }, []);

  const activeAudits = audits.filter((audit) => audit.status?.toLowerCase() !== 'resolved');
  const closedAudits = audits.filter((audit) => audit.status?.toLowerCase() === 'resolved');
  const visibleAudits = useMemo(() => {
    const source = tab === 'active' ? activeAudits : closedAudits;
    const search = query.trim().toLowerCase();
    if (!search) return source;
    return source.filter((audit) => [audit.title, audit.category, audit.severity, audit.status, audit.createdBy]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search)));
  }, [activeAudits, closedAudits, query, tab]);

  return (
    <section className="page-card register-page">
      <div className="page-heading">
        <div>
          <h1>Hazard register</h1>
          <p>{tab === 'active' ? 'Open hazards and incidents awaiting manager review.' : 'Resolved reports retained for WHS history.'}</p>
        </div>
        <Link className="primary-action" to="/submit">Create issue</Link>
      </div>
      <div className="tab-row">
        <button className={tab === 'active' ? 'active' : ''} type="button" onClick={() => setTab('active')}>
          Active
          <span>{activeAudits.length}</span>
        </button>
        <button className={tab === 'closed' ? 'active' : ''} type="button" onClick={() => setTab('closed')}>
          Resolved
          <span>{closedAudits.length}</span>
        </button>
      </div>
      <div className="people-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search hazard register..." />
      </div>
      {loading ? (
        <div className="empty-state">Loading safety reports...</div>
      ) : visibleAudits.length ? (
        <div className="card-list register-list">
          {visibleAudits.map((audit) => (
            <Link key={audit.id} to={`/audit/${audit.id}`}>
              <AuditCard audit={audit} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">{tab === 'active' ? 'No active hazards or incidents found.' : 'No resolved reports found.'}</div>
      )}
    </section>
  );
};

export default TeamAuditsPage;
