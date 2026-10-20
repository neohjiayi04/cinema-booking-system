import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../services/api.js";

export default function AdminProfile() {
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
          email: email.trim(),
        }),
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

  function handleReset() {
    setName(user.name || "");
    setEmail(user.email || "");
    setError("");
    setMessage("");
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  const initials = (user.name || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section className="admin-profile">
      {/* Identity card */}
      <div className="admin-profile-hero">
        <div className="admin-profile-avatar">{initials || "A"}</div>

        <div className="admin-profile-identity">
          <h2>{user.name}</h2>
          <p className="admin-profile-email">{user.email}</p>
          <span className="admin-role-badge">Administrator</span>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-danger admin-profile-logout"
          onClick={handleLogout}
        >
          <span aria-hidden="true">↪</span> Log Out
        </button>
      </div>

      <div className="admin-profile-card">
        <div className="admin-profile-card-head">
          <div>
            <h2>Personal Information</h2>
            <p>Keep your account details up to date.</p>
          </div>
          <span className="admin-profile-edit" aria-hidden="true">✎</span>
        </div>

        {message && (
          <div className="admin-alert admin-alert-success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="admin-alert admin-alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-profile-form">
          <label htmlFor="admin-profile-name">Full Name</label>
          <input
            id="admin-profile-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
          />

          <label htmlFor="admin-profile-email">Email Address</label>
          <input
            id="admin-profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
          />

          <label>Account Role</label>
          <div className="admin-profile-readonly">
            Administrator
            <span>Managed by CINEMAX</span>
          </div>

          <div className="admin-profile-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={handleReset}
            >
              Reset
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-profile-card admin-profile-security">
        <div>
          <h2>Account Security</h2>
          <p>
            Your account is protected by authenticated access. Never share
            your password or login token.
          </p>
        </div>
        <span className="admin-status admin-status-success">Protected</span>
      </div>
    </section>
  );
}