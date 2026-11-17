import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../services/api.js";
import "../../styles/UserProfile.css";

export default function UserProfile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!name.trim() || !email.trim()) {
      setError("Please enter your name and email address.");
      return;
    }

    setSaving(true);

    try {
      const result = await api("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim()
        })
      });

      updateUser(result.user);
      setName(result.user.name);
      setEmail(result.user.email);
      setMessage("Your profile has been updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  const initials = (user.name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="profile-page">
      <div className="profile-heading">
        <div>
          <h1>My Profile</h1>
          <p className="profile-subtitle">
            Manage your personal information and account.
          </p>
        </div>        
      </div>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-avatar">{initials || "U"}</div>
          <h2>{user.name}</h2>
          <p className="profile-email-preview">{user.email}</p>
          <span className="profile-role">
            {user.role === "admin" ? "Administrator" : "Cinema Member"}
          </span>

          <div className="profile-sidebar-divider" />

          <Link to="/" className="profile-menu-link">
            <span>⌂</span> Browse Movies
          </Link>
          <Link to="/my-bookings" className="profile-menu-link">
            <span>▤</span> My Bookings
          </Link>
          <button
            type="button"
            className="profile-menu-link profile-logout"
            onClick={handleLogout}
          >
            <span>↪</span> Log Out
          </button>
        </aside>

        <div className="profile-content">
          <div className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Personal Information</h2>
                <p>Keep your account details up to date.</p>
              </div>
              <span className="profile-edit-icon">✎</span>
            </div>

            {message && (
              <div className="profile-alert profile-success" role="status">
                {message}
              </div>
            )}

            {error && (
              <div className="profile-alert profile-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="profile-form">
              <label htmlFor="profile-name">Full Name</label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
              />

              <label htmlFor="profile-email">Email Address</label>
              <input
                id="profile-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />

              <label>Account Role</label>
              <div className="profile-readonly-field">
                {user.role === "admin" ? "Administrator" : "Customer"}
                <span>Managed by CINEMAX</span>
              </div>

              <div className="profile-form-actions">
                <button
                  type="button"
                  className="profile-cancel-button"
                  onClick={() => {
                    setName(user.name || "");
                    setEmail(user.email || "");
                    setError("");
                    setMessage("");
                  }}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          <div className="profile-card profile-security-card">
            <div>
              <h2>Account Security</h2>
              <p>
                Your account is protected by authenticated access.
                Never share your password or login token.
              </p>
            </div>
            <span className="profile-security-badge">Protected</span>
          </div>
        </div>
      </div>
    </section>
  );
}
