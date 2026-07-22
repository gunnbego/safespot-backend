import { useEffect, useMemo, useState } from 'react';
import { teamApi, MemberPayload, OrganizationMember, Team } from '../api/teamApi';

type Role = 'MEMBER' | 'MANAGER';
type MemberMode = 'invite' | 'view' | 'edit';

interface MemberFormState {
  id?: number;
  username: string;
  email: string;
  phone: string;
  role: Role;
  teamId: string;
  password: string;
}

const blankMemberForm: MemberFormState = {
  username: '',
  email: '',
  phone: '',
  role: 'MEMBER',
  teamId: '',
  password: ''
};

const TeamMembersPage = () => {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [memberForm, setMemberForm] = useState<MemberFormState>(blankMemberForm);
  const [memberMode, setMemberMode] = useState<MemberMode>('view');
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const sortedMembers = useMemo(
    () =>
      [...members]
        .filter((member) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return [member.username, member.email, member.phone, member.role, member.teamName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        })
        .sort((a, b) => a.username.localeCompare(b.username)),
    [members, search]
  );

  const unassignedCount = members.filter((member) => member.teamId == null).length;
  const managerCount = members.filter((member) => member.role === 'MANAGER').length;

  const loadManagerData = async () => {
    setLoading(true);
    setError('');
    try {
      const [memberData, teamData] = await Promise.all([
        teamApi.getOrganizationMembers(),
        teamApi.getTeams()
      ]);
      setMembers(memberData);
      setTeams(teamData);
    } catch (loadError: any) {
      setError(loadError.response?.data?.error ?? 'Could not load people and teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagerData();
  }, []);

  const memberPayload = (): MemberPayload => ({
    username: memberForm.username.trim(),
    email: memberForm.email.trim(),
    phone: memberForm.phone.trim(),
    role: memberForm.role,
    teamId: memberForm.teamId ? Number(memberForm.teamId) : null
  });

  const openInviteModal = () => {
    setSelectedMember(null);
    setMemberForm(blankMemberForm);
    setResetPasswordValue('');
    setMemberMode('invite');
    setMemberModalOpen(true);
    setMessage('');
    setError('');
  };

  const openMemberModal = (member: OrganizationMember, mode: MemberMode = 'view') => {
    setSelectedMember(member);
    setMemberForm({
      id: member.id,
      username: member.username,
      email: member.email ?? '',
      phone: member.phone ?? '',
      role: member.role,
      teamId: member.teamId == null ? '' : String(member.teamId),
      password: ''
    });
    setResetPasswordValue('');
    setMemberMode(mode);
    setMemberModalOpen(true);
    setMessage('');
    setError('');
  };

  const closeMemberModal = () => {
    setMemberModalOpen(false);
    setSelectedMember(null);
    setMemberForm(blankMemberForm);
    setResetPasswordValue('');
  };

  const handleSaveMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      if (memberMode === 'edit' && memberForm.id) {
        const updated = await teamApi.updateMember(memberForm.id, memberPayload());
        setSelectedMember(updated);
        setMemberMode('view');
        setMessage('User updated.');
      } else {
        if (!memberForm.password.trim()) {
          setError('Set a temporary password for the invite.');
          return;
        }
        const invited = await teamApi.inviteMember({ ...memberPayload(), password: memberForm.password });
        setSelectedMember(invited);
        setMemberMode('view');
        setMessage('User invited.');
      }
      await loadManagerData();
    } catch (saveError: any) {
      setError(saveError.response?.data?.error ?? 'Could not save user.');
    }
  };

  const deleteMember = async (member: OrganizationMember) => {
    setMessage('');
    setError('');
    try {
      await teamApi.deleteMember(member.id);
      closeMemberModal();
      setMessage(`${member.username} removed.`);
      await loadManagerData();
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.error ?? 'Could not delete user.');
    }
  };

  const resetPassword = async () => {
    if (!selectedMember || !resetPasswordValue.trim()) {
      setError('Enter a new password before resetting.');
      return;
    }

    setMessage('');
    setError('');
    try {
      await teamApi.resetMemberPassword(selectedMember.id, resetPasswordValue.trim());
      setResetPasswordValue('');
      setMessage(`Password reset for ${selectedMember.username}.`);
    } catch (resetError: any) {
      setError(resetError.response?.data?.error ?? 'Could not reset password.');
    }
  };

  const saveTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await teamApi.createTeam(teamName);
      setTeamName('');
      setTeamModalOpen(false);
      setMessage('Team created.');
      await loadManagerData();
    } catch (teamError: any) {
      setError(teamError.response?.data?.error ?? 'Could not create team.');
    }
  };

  const deleteTeam = async (team: Team) => {
    setMessage('');
    setError('');
    try {
      await teamApi.deleteTeam(team.id);
      setMessage(`${team.name} deleted.`);
      await loadManagerData();
    } catch (teamError: any) {
      setError(teamError.response?.data?.error ?? 'Could not delete team.');
    }
  };

  return (
    <section className="people-page">
      <div className="page-heading">
        <div>
          <h1>People & Teams</h1>
          <p>Manage users, roles, team assignments, and access details.</p>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={loadManagerData}>
            Refresh
          </button>
          <button type="button" onClick={openInviteModal}>
            Invite user
          </button>
          <button type="button" onClick={() => setTeamModalOpen(true)}>
            Create team
          </button>
        </div>
      </div>

      {message && <div className="form-message">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      <div className="people-summary-grid">
        <article>
          <span>Total users</span>
          <strong>{members.length}</strong>
          <p>{managerCount} managers</p>
        </article>
        <article>
          <span>Teams</span>
          <strong>{teams.length}</strong>
          <p>{unassignedCount} unassigned users</p>
        </article>
        <article>
          <span>Assigned users</span>
          <strong>{members.length - unassignedCount}</strong>
          <p>Across active teams</p>
        </article>
      </div>

      <div className="people-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users..."
        />
      </div>

      <div className="people-table-card">
        {loading ? (
          <div className="table-empty">Loading users...</div>
        ) : (
          <table className="manager-table people-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Team</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => (
                <tr key={member.id} onClick={() => openMemberModal(member)}>
                  <td>
                    <strong>{member.username}</strong>
                    <span>{member.organizationName || 'Organization member'}</span>
                  </td>
                  <td>
                    <span>{member.email || 'No email'}</span>
                    <span>{member.phone || 'No phone'}</span>
                  </td>
                  <td>
                    <span className="status-pill">{member.role}</span>
                  </td>
                  <td>{member.teamName || 'Unassigned'}</td>
                  <td>
                    <button
                      type="button"
                      className="kebab-button"
                      aria-label={`Manage ${member.username}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openMemberModal(member);
                      }}
                    >
                      ...
                    </button>
                  </td>
                </tr>
              ))}
              {sortedMembers.length === 0 && (
                <tr>
                  <td colSpan={5}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="team-strip">
        {teams.map((team) => (
          <article key={team.id}>
            <div>
              <strong>{team.name}</strong>
              <span>{team.memberCount} members</span>
            </div>
            <button type="button" className="danger-button" onClick={() => deleteTeam(team)}>
              Delete
            </button>
          </article>
        ))}
      </div>

      {memberModalOpen && (
        <div className="modal-backdrop" onClick={closeMemberModal}>
          <section className="audit-modal people-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeMemberModal} aria-label="Close user details">
              ×
            </button>
            <div className="page-heading">
              <div>
                <h1>{memberMode === 'invite' ? 'Invite user' : selectedMember?.username}</h1>
                <p>{memberMode === 'view' ? 'User details and management actions.' : 'Update user access and assignment.'}</p>
              </div>
              {memberMode === 'view' && selectedMember && (
                <button type="button" onClick={() => setMemberMode('edit')}>
                  Edit user
                </button>
              )}
            </div>

            {(memberMode === 'invite' || memberMode === 'edit') ? (
              <form className="form-grid" onSubmit={handleSaveMember}>
                <label>
                  Username
                  <input
                    value={memberForm.username}
                    onChange={(event) => setMemberForm({ ...memberForm, username: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    value={memberForm.email}
                    onChange={(event) => setMemberForm({ ...memberForm, email: event.target.value })}
                    type="email"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={memberForm.phone}
                    onChange={(event) => setMemberForm({ ...memberForm, phone: event.target.value })}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={memberForm.role}
                    onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as Role })}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
                <label>
                  Team
                  <select
                    value={memberForm.teamId}
                    onChange={(event) => setMemberForm({ ...memberForm, teamId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                {memberMode === 'invite' && (
                  <label>
                    Temporary password
                    <input
                      value={memberForm.password}
                      onChange={(event) => setMemberForm({ ...memberForm, password: event.target.value })}
                      type="password"
                      required
                    />
                  </label>
                )}
                <div className="button-row">
                  <button type="submit">{memberMode === 'invite' ? 'Send invite' : 'Save changes'}</button>
                  {memberMode === 'edit' && (
                    <button type="button" className="secondary-button" onClick={() => setMemberMode('view')}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : selectedMember ? (
              <div className="user-detail-grid">
                <div>
                  <span>Email</span>
                  <strong>{selectedMember.email || 'No email'}</strong>
                </div>
                <div>
                  <span>Phone</span>
                  <strong>{selectedMember.phone || 'No phone'}</strong>
                </div>
                <div>
                  <span>Role</span>
                  <strong>{selectedMember.role}</strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>{selectedMember.teamName || 'Unassigned'}</strong>
                </div>
                <div className="password-reset-panel">
                  <span>Reset password</span>
                  <div className="inline-control">
                    <input
                      value={resetPasswordValue}
                      onChange={(event) => setResetPasswordValue(event.target.value)}
                      type="password"
                      placeholder="New password"
                    />
                    <button type="button" onClick={resetPassword}>
                      Reset
                    </button>
                  </div>
                </div>
                <div className="button-row">
                  <button type="button" className="danger-button" onClick={() => deleteMember(selectedMember)}>
                    Delete user
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {teamModalOpen && (
        <div className="modal-backdrop" onClick={() => setTeamModalOpen(false)}>
          <section className="audit-modal people-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setTeamModalOpen(false)} aria-label="Close team form">
              ×
            </button>
            <div className="page-heading">
              <div>
                <h1>Create team</h1>
                <p>Add a team that users can be assigned to.</p>
              </div>
            </div>
            <form className="form-grid" onSubmit={saveTeam}>
              <label>
                Team name
                <input value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
              </label>
              <button type="submit">Create team</button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};

export default TeamMembersPage;
