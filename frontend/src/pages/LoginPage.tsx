import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await login(username, password, organizationSlug);
      navigate('/');
    } catch (e: any) {
      if (e.response?.status === 404) {
        setError('Organization not found. Please check the organization name.');
      } else if (e.response?.status === 401) {
        setError('Invalid username/email or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  };

  return (
    <section className="page-card">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Organization
          <input 
            value={organizationSlug} 
            onChange={(event) => setOrganizationSlug(event.target.value)} 
            type="text" 
            placeholder="e.g., my-org"
            required 
          />
        </label>
        <label>
          Username or Email
          <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        <button type="submit">Sign In</button>
        {error && <div className="form-error">{error}</div>}
        <div className="form-footer">
          <span>New here?</span>{' '}
          <Link to="/register">Create an account</Link>
        </div>
      </form>
    </section>
  );
};

export default LoginPage;
