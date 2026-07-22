interface AuditCardProps {
  audit: {
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
  };
}

const riskClass = (severity: string) => {
  const normalized = severity?.toLowerCase();
  if (normalized === 'high' || normalized === 'extreme') return 'risk-high';
  if (normalized === 'medium') return 'risk-medium';
  return 'risk-low';
};

const AuditCard = ({ audit }: AuditCardProps) => {
  const isResolved = audit.status?.toLowerCase() === 'resolved';

  return (
    <article className={`entity-card safety-card ${isResolved ? 'resolved' : ''}`}>
      <div>
        <span className="type-label">{audit.category}</span>
        <h2>{audit.title}</h2>
      </div>
      <div className="entity-meta">
        <span className={riskClass(audit.severity)}>{audit.severity}</span>
        <span>{audit.status}</span>
        {Number(audit.photoCount ?? 0) > 0 && <span>{audit.photoCount} photos</span>}
      </div>
      {isResolved && audit.resolvedBy ? (
        <div className="entity-submeta">Resolved by: {audit.resolvedBy}</div>
      ) : (
        <div className="entity-submeta">
          Raised by: {audit.submittedBy || audit.createdBy || 'Unknown'}
          {audit.createdAt ? ` · ${new Date(audit.createdAt).toLocaleString()}` : ''}
        </div>
      )}
    </article>
  );
};

export default AuditCard;
