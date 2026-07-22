import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

const isHighRisk = (audit: Audit) => ['high', 'extreme', 'critical'].includes(audit.severity?.toLowerCase());

const TeamAuditsPage = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    auditApi
      .getTeamAudits()
      .then((data) => setAudits(data))
      .finally(() => setLoading(false));
  }, []);

  const tab: 'active' | 'closed' = searchParams.get('status') === 'closed' ? 'closed' : 'active';
  const categoryFilter = searchParams.get('category')?.toLowerCase() ?? '';
  const severityFilter = searchParams.get('severity') ?? '';
  const photosOnly = searchParams.get('photos') === '1';

  const activeAudits = audits.filter((audit) => audit.status?.toLowerCase() !== 'resolved');
  const closedAudits = audits.filter((audit) => audit.status?.toLowerCase() === 'resolved');
  const visibleAudits = useMemo(() => {
    const source = tab === 'active' ? activeAudits : closedAudits;
    const search = query.trim().toLowerCase();
    return source
      .filter((audit) => !categoryFilter || audit.category?.toLowerCase() === categoryFilter)
      .filter((audit) => severityFilter !== 'high-risk' || isHighRisk(audit))
      .filter((audit) => !photosOnly || Number(audit.photoCount ?? 0) > 0)
      .filter((audit) => {
        if (!search) return true;
        return [audit.title, audit.category, audit.severity, audit.status, audit.createdBy, audit.submittedBy]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      });
  }, [activeAudits, categoryFilter, closedAudits, photosOnly, query, severityFilter, tab]);

  const setTab = (nextTab: 'active' | 'closed') => {
    const next = new URLSearchParams(searchParams);
    next.set('status', nextTab);
    setSearchParams(next);
  };

  const clearFilters = () => {
    setQuery('');
    setSearchParams({ status: tab });
  };

  const activeFilterLabels = [
    categoryFilter ? `${categoryFilter[0].toUpperCase()}${categoryFilter.slice(1)} only` : '',
    severityFilter === 'high-risk' ? 'High risk only' : '',
    photosOnly ? 'With evidence photos' : ''
  ].filter(Boolean);

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
        {activeFilterLabels.length > 0 && (
          <>
            <span className="filter-summary">{activeFilterLabels.join(' · ')}</span>
            <button type="button" className="secondary-button" onClick={clearFilters}>
              Clear filters
            </button>
          </>
        )}
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
