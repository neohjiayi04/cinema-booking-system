import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <section>
      <span className="eyebrow">ADMINISTRATION</span>
      <h1>Dashboard</h1>
      <div className="admin-grid">
        <Link className="admin-card" to="/admin/movies"><strong>Movies</strong><span>Manage movie catalogue</span></Link>
        <Link className="admin-card" to="/admin/halls"><strong>Halls</strong><span>Manage 3 cinema halls</span></Link>
        <Link className="admin-card" to="/admin/showtimes"><strong>Showtimes</strong><span>Create movie sessions</span></Link>
        <Link className="admin-card" to="/admin/bookings"><strong>Bookings</strong><span>View customer bookings</span></Link>
        <Link className="admin-card" to="/admin/profile"><strong>Profile</strong><span>Admin account</span></Link>
      </div>
    </section>
  );
}
