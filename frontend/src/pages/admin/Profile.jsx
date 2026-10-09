import { useAuth } from "../../context/AuthContext.jsx";

export default function Profile() {
  const { user } = useAuth();

  return (
    <section className="auth-card">
      <span className="eyebrow">ADMIN</span>
      <h1>Profile</h1>
      <p><strong>Name:</strong> {user?.name}</p>
      <p><strong>Email:</strong> {user?.email}</p>
      <p><strong>Role:</strong> {user?.role}</p>
    </section>
  );
}
