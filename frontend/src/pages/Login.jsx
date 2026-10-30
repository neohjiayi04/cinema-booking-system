import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const [email, setEmail] = useState("customer@cinema.local");
  const [password, setPassword] = useState("Customer123!");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : returnTo, { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
   <div className="auth-page-wrapper">
    <section className="auth-card">
      <h1>Welcome Back</h1>
      <p>Sign in to continue booking your movie.</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="button full">Login</button>
      </form>
      <p>Don&apos;t have an account? <Link to={`/register${returnTo !== "/" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>Register</Link></p>
    </section>
   </div>
  );
}
