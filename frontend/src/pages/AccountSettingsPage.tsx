import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import ButtonLoader from '../components/ButtonLoader';

const AccountSettingsPage = () => {
  const { user, updateAccount } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setSaving(true);
    try {
      await updateAccount(name, email);
      setMessage('Account updated successfully.');
    } catch (error) {
      setMessage('Could not update account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page-card">
      <h1>Account Settings</h1>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <button type="submit" disabled={saving}>
          <ButtonLoader loading={saving} loadingText="Saving...">Save Changes</ButtonLoader>
        </button>
        {message && <div className="form-message">{message}</div>}
      </form>
    </section>
  );
};

export default AccountSettingsPage;
