import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditApi } from '../api/auditApi';
import { useAuth } from '../auth/AuthProvider';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1800;

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare image for upload.'))),
      'image/jpeg',
      quality
    );
  });

export const compressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only images can be attached.');
  }

  if (file.size <= MAX_UPLOAD_BYTES) return file;

  const image = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read image.');
  });

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not compress image.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await canvasToBlob(canvas, 0.82);
    if (blob.size > MAX_UPLOAD_BYTES) blob = await canvasToBlob(canvas, 0.68);

    const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], compressedName, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    image.close();
  }
};

const SubmitAuditPage = () => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Hazard');
  const [severity, setSeverity] = useState('Medium');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setMessage('');
    const files = Array.from(event.target.files ?? []);
    try {
      const compressedPhotos = await Promise.all(files.map(compressImage));
      setPhotos(compressedPhotos);
    } catch (error: any) {
      setPhotos([]);
      setMessage(error.message ?? 'Could not prepare photos.');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    try {
      await auditApi.submitAudit({ title, category, severity, status: 'Open', notes, teamId: user?.teamId, photos });
      setMessage('Safety report submitted.');
      navigate(user?.role === 'manager' ? '/team-audits' : '/my-audits');
    } catch (error: any) {
      if (error.response?.status === 403) {
        setMessage('You can only submit reports for your assigned team.');
      } else if (error.response?.status === 401) {
        setMessage('Your session expired. Please sign in again.');
      } else if (error.response?.status === 400) {
        setMessage('You need to be assigned to a team before submitting a report.');
      } else {
        setMessage('Could not submit safety report.');
      }
    }
  };

  return (
    <section className="page-card report-form-page">
      <div className="page-heading">
        <div>
          <h1>Create safety report</h1>
          <p>Capture hazards, incidents, controls, or resolution requests with photo evidence.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="form-grid report-form">
        <label>
          Issue title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Exposed edge on level 2" />
        </label>
        <div className="form-two-col">
          <label>
            Type
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>Hazard</option>
              <option>Incident</option>
              <option>Near miss</option>
              <option>Control</option>
              <option>Resolution request</option>
            </select>
          </label>
          <label>
            Risk level
            <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Extreme</option>
            </select>
          </label>
        </div>
        <label>
          Details
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} required placeholder="What happened, where is it, who is affected, and what immediate controls are in place?" />
        </label>
        <label>
          Hazard or incident photos
          <input type="file" accept="image/*" multiple onChange={handlePhotoChange} />
        </label>
        {photos.length > 0 && (
          <div className="photo-list">
            {photos.map((photo) => (
              <span key={`${photo.name}-${photo.size}`}>{photo.name}</span>
            ))}
          </div>
        )}
        <button type="submit">Submit report</button>
        {message && <div className="form-message">{message}</div>}
      </form>
    </section>
  );
};

export default SubmitAuditPage;
