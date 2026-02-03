import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <div className="navbar bg-base-100 shadow-md px-4 sm:px-8">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl font-bold text-primary">
          ☕ Tropis Coffee
        </Link>
      </div>
      <div className="flex-none">
        <Link to="/admin" className="btn btn-ghost btn-sm">
          Login Admin
        </Link>
      </div>
    </div>
  );
}