import "../styles/RoleCard.css";

interface RoleCardProps {
  role: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export default function RoleCard({ role, description, selected, disabled, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`role-card ${selected ? "role-card-selected" : "role-card-unselected"}`}
    >
      <h3 className="role-card-title">{role}</h3>
      <p className="role-card-description">{description}</p>
    </button>
  );
}
