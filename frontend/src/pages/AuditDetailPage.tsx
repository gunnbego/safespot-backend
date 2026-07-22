import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auditApi } from '../api/auditApi';
import httpClient from '../api/httpClient';
import { useAuth } from '../auth/AuthProvider';
import { compressImage } from './SubmitAuditPage';

interface AuditPhoto {
  id: string;
  fileName?: string;
  contentType: string;
  sizeBytes: number;
  dataUrl?: string | null;
  imageUrl?: string | null;
  purpose?: string;
}

interface AuditDetail {
  id: string;
  title: string;
  category: string;
  severity: string;
  notes: string;
  status: string;
  submittedBy?: string;
  createdBy?: string;
  createdAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionComment?: string;
  photos?: AuditPhoto[];
}

const AuditPhotoImage = ({ photo, alt }: { photo: AuditPhoto; alt: string }) => {
  const [src, setSrc] = useState(photo.dataUrl || '');

  useEffect(() => {
    if (!photo.imageUrl) {
      setSrc(photo.dataUrl || '');
      return;
    }

    let objectUrl = '';
    let cancelled = false;
    httpClient
      .get(photo.imageUrl, { responseType: 'blob' })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(photo.dataUrl || '');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.dataUrl, photo.imageUrl]);

  if (!src) return null;
  return <img src={src} alt={alt} />;
};

const AuditDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolutionPhotos, setResolutionPhotos] = useState<File[]>([]);

  const closeModal = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(user?.role === 'manager' ? '/team-audits' : '/my-audits');
  };

  useEffect(() => {
    if (!id) return;
    auditApi
      .getAuditById(id)
      .then((data) => setAudit(data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleResolutionPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage('');
    const files = Array.from(event.target.files ?? []);
    try {
      setResolutionPhotos(await Promise.all(files.map(compressImage)));
    } catch (error: any) {
      setResolutionPhotos([]);
      setMessage(error.message ?? 'Could not prepare resolution photos.');
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={closeModal}>
        <section className="audit-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" onClick={closeModal} aria-label="Close report details">x</button>
          Loading report details...
        </section>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="modal-backdrop" onClick={closeModal}>
        <section className="audit-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" onClick={closeModal} aria-label="Close report details">x</button>
          Safety report not found.
        </section>
      </div>
    );
  }

  const isResolved = audit.status?.toLowerCase() === 'resolved';
  const canResolve = user?.role === 'manager' && !isResolved;
  const hazardPhotos = (audit.photos ?? []).filter((photo) => photo.purpose !== 'RESOLUTION');
  const closurePhotos = (audit.photos ?? []).filter((photo) => photo.purpose === 'RESOLUTION');

  const handleResolve = async () => {
    if (!id) return;
    setMessage('');
    try {
      const resolvedAudit = await auditApi.resolveAudit(id, resolutionComment, resolutionPhotos);
      setAudit(resolvedAudit);
      setResolutionComment('');
      setResolutionPhotos([]);
      setMessage('Report marked as resolved.');
    } catch {
      setMessage('Could not resolve report.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <section className="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-modal-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={closeModal} aria-label="Close report details">x</button>
        <div className="page-heading">
          <div>
            <span className="type-label">{audit.category}</span>
            <h1 id="audit-modal-title">{audit.title}</h1>
            <p>{audit.severity} risk · {audit.status}</p>
          </div>
          {canResolve && (
            <button className="resolve-button" type="button" onClick={handleResolve}>Mark resolved</button>
          )}
        </div>
        {message && <div className="form-message">{message}</div>}
        <div className="review-panel">
          <strong>Report details</strong>
          <div>Raised by: {audit.submittedBy || audit.createdBy || 'Unknown'}</div>
          <div>Raised at: {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : 'Unknown'}</div>
        </div>
        <div className="detail-block">
          <strong>Notes and immediate controls</strong>
          <p>{audit.notes}</p>
        </div>
        {hazardPhotos.length > 0 && (
          <div className="detail-block">
            <strong>Hazard or incident photos</strong>
            <div className="audit-photo-grid">
              {hazardPhotos.map((photo) => <AuditPhotoImage key={photo.id} photo={photo} alt={photo.fileName || 'Report photo'} />)}
            </div>
          </div>
        )}
        {isResolved && (
          <div className="resolution-panel">
            <strong>Resolution</strong>
            <div>Closed by: {audit.resolvedBy || 'Unknown'}</div>
            <div>Closed at: {audit.resolvedAt ? new Date(audit.resolvedAt).toLocaleString() : 'Unknown'}</div>
            <div>Controls or resolution: {audit.resolutionComment || 'No comments added.'}</div>
          </div>
        )}
        {closurePhotos.length > 0 && (
          <div className="detail-block">
            <strong>Resolution evidence</strong>
            <div className="audit-photo-grid">
              {closurePhotos.map((photo) => <AuditPhotoImage key={photo.id} photo={photo} alt={photo.fileName || 'Resolution photo'} />)}
            </div>
          </div>
        )}
        {canResolve && (
          <div className="resolution-form">
            <label className="resolution-comment">
              Resolution or control notes
              <textarea value={resolutionComment} onChange={(event) => setResolutionComment(event.target.value)} rows={3} placeholder="What control was applied and why is this safe to close?" />
            </label>
            <label className="resolution-comment">
              Resolution photos
              <input type="file" accept="image/*" multiple onChange={handleResolutionPhotoChange} />
            </label>
            {resolutionPhotos.length > 0 && (
              <div className="photo-list">
                {resolutionPhotos.map((photo) => <span key={`${photo.name}-${photo.size}`}>{photo.name}</span>)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AuditDetailPage;
