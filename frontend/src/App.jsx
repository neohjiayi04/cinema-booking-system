import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import MovieDetails from "./pages/MovieDetails.jsx";
import SeatBooking from "./pages/SeatBooking.jsx";
import BookingConfirmation from "./pages/BookingConfirmation.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminMovies from "./pages/admin/Movies.jsx";
import AdminHalls from "./pages/admin/Halls.jsx";
import AdminShowtimes from "./pages/admin/Showtimes.jsx";
import AdminBookings from "./pages/admin/Bookings.jsx";
import AdminProfile from "./pages/admin/Profile.jsx";

function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? children : <Navigate to="/" replace />;
}


function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);

  function handleLogout() {
    setOpenMenu(null);
    logout();
    navigate("/login", { replace: true });
  }

  function closeMenus() {
    setOpenMenu(null);
  }

  return (
    <header className="navbar">
      <Link
        className="brand"
        to={user?.role === "admin" ? "/admin" : "/"}
        onClick={closeMenus}
      >
        CINEMAX
        {user?.role === "admin" && (
          <span className="navbar-brand-label">ADMIN</span>
        )}
      </Link>

      <nav className="navbar-links">
        {!user && (
          <>
            <Link to="/">Movies</Link>
            <Link to="/login" className="navbar-login">Login</Link>
          </>
        )}

        {user?.role === "customer" && (
          <>
            <Link to="/" onClick={closeMenus}>Movies</Link>
            <Link to="/my-bookings" onClick={closeMenus}>
              My Bookings
            </Link>

            <Link to="/profile" onClick={closeMenus}>
              My Profile
            </Link>
            <button className="link-button" onClick={() => {logout(); navigate("/login");}}
            >
              Log Out
            </button>
          </>
        )}

        {user?.role === "admin" && (
          <>
            <Link to="/admin" onClick={closeMenus}>Dashboard</Link>

            <div className="nav-dropdown">
              <button
                type="button"
                className="nav-dropdown-trigger"
                aria-expanded={openMenu === "management"}
                onClick={() =>
                  setOpenMenu(
                    openMenu === "management" ? null : "management"
                  )
                }
              >
                Management <span>⌄</span>
              </button>

              {openMenu === "management" && (
                <div className="nav-dropdown-menu">
                  <Link to="/admin/movies" onClick={closeMenus}>Movies</Link>
                  <Link to="/admin/halls" onClick={closeMenus}>Halls</Link>
                  <Link to="/admin/showtimes" onClick={closeMenus}>
                    Showtimes
                  </Link>
                  <Link to="/admin/users" onClick={closeMenus}>Users</Link>
                </div>
              )}
            </div>

            <Link to="/admin/bookings" onClick={closeMenus}>
              Bookings
            </Link>

            <Link to="/admin/profile">
              Admin Profile
            </Link>
            
            <button className="link-button" onClick={() => {logout(); navigate("/login");}}
            >
              Log Out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/booking/:id" element={<RequireAuth><SeatBooking /></RequireAuth>} />
          <Route path="/booking-confirmation/:id" element={<RequireAuth><BookingConfirmation /></RequireAuth>} />
          <Route path="/my-bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><UserProfile /></RequireAuth>}/>

          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/movies" element={<RequireAdmin><AdminMovies /></RequireAdmin>} />
          <Route path="/admin/halls" element={<RequireAdmin><AdminHalls /></RequireAdmin>} />
          <Route path="/admin/showtimes" element={<RequireAdmin><AdminShowtimes /></RequireAdmin>} />
          <Route path="/admin/bookings" element={<RequireAdmin><AdminBookings /></RequireAdmin>} />
          <Route path="/admin/profile" element={<RequireAdmin><AdminProfile /></RequireAdmin>} />
        </Routes>
      </main>
    </>
  );
}
