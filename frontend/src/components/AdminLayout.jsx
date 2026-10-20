import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/admin.css";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: "▦" },
  { label: "Movies", path: "/admin/movies", icon: "▣" },
  { label: "Halls", path: "/admin/halls", icon: "▤" },
  { label: "Showtimes", path: "/admin/showtimes", icon: "◷" },
  { label: "Bookings", path: "/admin/bookings", icon: "▧" },
  { label: "Profile", path: "/admin/profile", icon: "◉" },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const today = new Date().toLocaleDateString("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <NavLink to="/admin" className="admin-brand">
          CINEMAX
          <span>ADMIN PANEL</span>
        </NavLink>

        <p className="admin-nav-label">WORKSPACE</p>

        <nav className="admin-sidebar-nav" aria-label="Admin">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? " active" : ""}`
              }
            >
              <span className="admin-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="admin-logout"
          onClick={handleLogout}
        >
          <span className="admin-nav-icon" aria-hidden="true">
            ↪
          </span>
          Log Out
        </button>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">

          <div className="admin-topbar-actions">
            <span className="admin-topbar-date">{today}</span>
            <Link
              to="/"
              className="admin-btn admin-btn-secondary admin-btn-sm"
            >
              View Site
            </Link>
            <span className="admin-role-badge">Admin</span>
          </div>
        </header>

        <main className="admin-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
