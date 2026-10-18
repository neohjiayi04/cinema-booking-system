import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
  <div className="auth-page-wrapper">
    <section className="auth-card">
      <h1>Create Account</h1>
      <p>Register as a cinema customer.</p>
      <form onSubmit={submit}>
        <label>Name<input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></label>
        <label>Email<input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" required /></label>
        <label>Password<input value={form.password} onChange={e => setForm({...form, password: e.target.value})} type="password" minLength="8" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="button full">Register</button>
      </form>
      <p>Already registered? <Link to="/login">Login</Link></p>
    </section>
  </div>
  );
}
