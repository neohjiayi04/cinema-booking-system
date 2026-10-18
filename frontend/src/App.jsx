
import { useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  Outlet,
  useNavigate,
} from "react-router-dom";
import AdminLayout from "./components/AdminLayout.jsx";
import { useAuth } from "./context/AuthContext.jsx";

// Customer pages
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import MovieDetails from "./pages/MovieDetails.jsx";
import SeatBooking from "./pages/SeatBooking.jsx";
import BookingConfirmation from "./pages/BookingConfirmation.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import UserProfile from "./pages/UserProfile.jsx";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminMovies from "./pages/admin/Movies.jsx";
import AdminHalls from "./pages/admin/Halls.jsx";
import AdminShowtimes from "./pages/admin/Showtimes.jsx";
import AdminBookings from "./pages/admin/Bookings.jsx";
import AdminProfile from "./pages/admin/Profile.jsx";

// Uncomment these lines only if Users.jsx exists:
// import AdminUsers from "./pages/admin/Users.jsx";

function RequireAuth({ children }) {
  const { user } = useAuth();

  return user ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);

  function closeMenus() {
    setOpenMenu(null);
  }

  function handleLogout() {
    closeMenus();
    logout();
    navigate("/login", { replace: true });
  }

  function toggleMenu(menuName) {
    setOpenMenu((current) =>
      current === menuName ? null : menuName
    );
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
        {/* Guest navigation */}
        {!user && (
          <>
            <Link to="/" onClick={closeMenus}>
              Movies
            </Link>

            <Link
              to="/login"
              className="navbar-login"
              onClick={closeMenus}
            >
              Login
            </Link>
          </>
        )}

        {/* Customer navigation */}
        {user?.role === "customer" && (
          <>
            <Link to="/" onClick={closeMenus}>
              Movies
            </Link>

            <Link to="/my-bookings" onClick={closeMenus}>
              My Bookings
            </Link>

            <Link to="/profile" onClick={closeMenus}>
              My Profile
            </Link>

            <button
              type="button"
              className="link-button"
              onClick={handleLogout}
            >
              Log Out
            </button>
          </>
        )}

        {/* Admin navigation */}
        {user?.role === "admin" && (
          <>
            <Link to="/admin" onClick={closeMenus}>
              Dashboard
            </Link>

            <div className="nav-dropdown">
              <button
                type="button"
                className="nav-dropdown-trigger"
                aria-expanded={openMenu === "management"}
                onClick={() => toggleMenu("management")}
              >
                Management <span>⌄</span>
              </button>

              {openMenu === "management" && (
                <div className="nav-dropdown-menu">
                  <Link to="/admin/movies" onClick={closeMenus}>
                    Movies
                  </Link>

                  <Link to="/admin/halls" onClick={closeMenus}>
                    Halls
                  </Link>

                  <Link to="/admin/showtimes" onClick={closeMenus}>
                    Showtimes
                  </Link>

                  {/* Enable when the Users page exists */}
                  {/* <Link to="/admin/users" onClick={closeMenus}>
                    Users
                  </Link> */}
                </div>
              )}
            </div>

            <Link to="/admin/bookings" onClick={closeMenus}>
              Bookings
            </Link>

            <Link to="/admin/profile" onClick={closeMenus}>
              Admin Profile
            </Link>

            <button
              type="button"
              className="link-button"
              onClick={handleLogout}
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
    <Routes>
      {/* Customer and public layout: top navbar */}
      <Route
        element={
          <>
            <Navbar />
            <main className="container">
              <Outlet />
            </main>
          </>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/movies/:id" element={<MovieDetails />} />

        <Route
          path="/booking/:id"
          element={
            <RequireAuth>
              <SeatBooking />
            </RequireAuth>
          }
        />

        <Route
          path="/booking-confirmation/:id"
          element={
            <RequireAuth>
              <BookingConfirmation />
            </RequireAuth>
          }
        />

        <Route
          path="/my-bookings"
          element={
            <RequireAuth>
              <MyBookings />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <UserProfile />
            </RequireAuth>
          }
        />
      </Route>

      {/* Admin layout: sidebar */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="movies" element={<AdminMovies />} />
        <Route path="halls" element={<AdminHalls />} />
        <Route path="showtimes" element={<AdminShowtimes />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      {/* Unknown URL */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
