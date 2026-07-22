interface TeamMemberCardProps {
  member: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const TeamMemberCard = ({ member }: TeamMemberCardProps) => {
  return (
    <article className="entity-card">
      <h2>{member.name}</h2>
      <div className="entity-meta">
        <span>{member.role}</span>
        <span>{member.email}</span>
      </div>
    </article>
  );
};

export default TeamMemberCard;
