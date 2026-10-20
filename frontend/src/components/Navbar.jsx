import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "../styles/Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);

  const isAdmin = user?.role === "admin";

  // Close the mobile menu whenever the page changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on outside click or Escape while the menu is open
  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  const links = [{ to: "/", label: "Movies", end: true }];

  if (user && !isAdmin) {
    links.push(
      { to: "/my-bookings", label: "My Bookings" },
      { to: "/profile", label: "My Profile" }
    );
  }

  if (isAdmin) {
    // Admins manage everything from the sidebar layout, so the public
    // navbar only needs a way back into it.
    links.push({ to: "/admin", label: "Admin Panel" });
  }

  const linkClass = ({ isActive }) =>
    `navbar-link${isActive ? " active" : ""}`;

  return (
    <header className="navbar" ref={headerRef}>
      <Link className="brand" to={isAdmin ? "/admin" : "/"}>
        <span className="brand-mark" aria-hidden="true" />
        CINEMAX
        {isAdmin && <span className="navbar-brand-label">ADMIN</span>}
      </Link>

      <button
        type="button"
        className="navbar-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="primary-nav"
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        id="primary-nav"
        className={`navbar-links${open ? " is-open" : ""}`}
        aria-label="Primary"
      >
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClass}
          >
            {item.label}
          </NavLink>
        ))}

        <span className="navbar-divider" aria-hidden="true" />

        {!user && (
          <>
            <NavLink to="/login" className={linkClass}>
              Log In
            </NavLink>
            <Link to="/register" className="navbar-cta">
              Sign Up
            </Link>
          </>
        )}

        {user && (
          <button
            type="button"
            className="navbar-link navbar-logout"
            onClick={handleLogout}
          >
            Log Out
          </button>
        )}
      </nav>
    </header>
  );
}
