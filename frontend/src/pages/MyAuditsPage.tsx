import { useEffect, useState } from 'react';
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

const MyAuditsPage = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi
      .getMyAudits()
      .then((data) => setAudits(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-card register-page">
      <div className="page-heading">
        <div>
          <h1>My reports</h1>
          <p>Hazards, incidents, and controls you have raised.</p>
        </div>
        <Link className="primary-action" to="/submit">Report issue</Link>
      </div>
      {loading ? (
        <div className="empty-state">Loading reports...</div>
      ) : audits.length ? (
        <div className="card-list register-list">
          {audits.map((audit) => (
            <Link key={audit.id} to={`/audit/${audit.id}`}>
              <AuditCard audit={audit} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">No safety reports found.</div>
      )}
    </section>
  );
};

export default MyAuditsPage;
