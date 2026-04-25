import { Link } from "react-router-dom";
import "../styles/Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Code Live
      </Link>

      <Link to="/auth" className="navbar-link">
        Login / Sign up
      </Link>
    </nav>
  );
}
