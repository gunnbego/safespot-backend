import { FormEvent, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/authApi';

const RegisterPage = () => {
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      await authApi.register({
        username,
        password,
        organizationSlug,
      });
      navigate('/login');
    } catch (e: any) {
      if (e.response?.status === 409) {
        setError('Username already exists in this organization. Please choose another.');
      } else if (e.response?.status === 404) {
        setError('Organization not found. Please check the organization name.');
      } else {
        setError('Unable to create account. Please check your information and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-card">
      <h1>Create an Account</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Organization
          <input
            type="text"
            value={organizationSlug}
            onChange={(event) => setOrganizationSlug(event.target.value)}
            placeholder="e.g., my-org"
            required
          />
        </label>
        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? 'Creating account...' : 'Create Account'}
        </button>
        {error && <div className="form-error">{error}</div>}
        <div className="form-footer">
          <span>Already have an account?</span>{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </form>
    </section>
  );
};

export default RegisterPage;
