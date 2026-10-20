import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api.js";

const getArray = (response) => {
  // api() returns the parsed JSON body directly (an array, or an object
  // wrapping one), so fall back to the response itself.
  const data = response?.data ?? response;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;

  return [];
};

const getId = (item) =>
  item?._id || item?.id || "—";

const getDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const getBookingStatus = (booking) =>
  String(booking?.status || "pending").toLowerCase();

const statusClass = (status) => {
  if (["confirmed", "paid", "completed"].includes(status)) {
    return "admin-status-success";
  }

  if (["pending", "processing"].includes(status)) {
    return "admin-status-warning";
  }

  if (["cancelled", "canceled", "failed"].includes(status)) {
    return "admin-status-danger";
  }

  return "admin-status-neutral";
};

function StatCard({ icon, label, value, description, loading }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className="admin-stat-value">
        {loading ? "…" : value.toLocaleString()}
      </div>

      <span className="admin-stat-caption">{description}</span>
    </article>
  );
}

export default function AdminDashboard() {
  const [movies, setMovies] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [showtimes, setShowtimes] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.allSettled([
          api("/movies"),
          api("/bookings"),
          api("/users"),
          api("/showtimes"),
        ]);

        if (!active) return;

        const [movieResult, bookingResult, userResult, showtimeResult] =
          results;

        const failed = results.some(
          (result) => result.status === "rejected"
        );

        if (movieResult.status === "fulfilled") {
          setMovies(getArray(movieResult.value));
        }

        if (bookingResult.status === "fulfilled") {
          setBookings(getArray(bookingResult.value));
        }

        if (userResult.status === "fulfilled") {
          setUsers(getArray(userResult.value));
        }

        if (showtimeResult.status === "fulfilled") {
          setShowtimes(getArray(showtimeResult.value));
        }

        if (failed) {
          setError(
            "Some dashboard information could not be loaded. Check your connection and permissions."
          );
        }
      } catch {
        if (active) {
          setError("Unable to load dashboard information.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const today = new Date();

  const todaysShowtimes = showtimes.filter((showtime) => {
    const value =
      showtime?.startTime ||
      showtime?.showDateTime ||
      showtime?.dateTime ||
      showtime?.date;

    if (!value) return false;

    const date = new Date(value);

    return (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  });

  const recentBookings = [...bookings]
    .sort((a, b) => {
      const dateA = new Date(
        a?.createdAt || a?.bookingDate || 0
      ).getTime();

      const dateB = new Date(
        b?.createdAt || b?.bookingDate || 0
      ).getTime();

      return dateB - dateA;
    })
    .slice(0, 5);

  const formatMoney = (value) =>
    `RM ${Number(value || 0).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="admin-page-description">
            A clear overview of your cinema operations.
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            to="/admin/movies"
            className="admin-btn admin-btn-primary"
          >
            + Add Movie
          </Link>

          <Link
            to="/admin/showtimes"
            className="admin-btn admin-btn-secondary"
          >
            Create Showtime
          </Link>
        </div>
      </div>

      {error && (
        <div
          className="admin-alert admin-alert-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="admin-stats-grid">
        <StatCard
          icon="▣"
          label="Total Movies"
          value={movies.length}
          description="Movies in catalogue"
          loading={loading}
        />

        <StatCard
          icon="▤"
          label="Total Bookings"
          value={bookings.length}
          description="All recorded bookings"
          loading={loading}
        />

        <StatCard
          icon="♙"
          label="Registered Users"
          value={users.length}
          description="Customer and admin accounts"
          loading={loading}
        />

        <StatCard
          icon="◷"
          label="Shows Today"
          value={todaysShowtimes.length}
          description="Scheduled for today"
          loading={loading}
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-panel-title">
              Recent Bookings
            </h2>
            <p className="admin-panel-subtitle">
              The latest booking activity in your cinema.
            </p>
          </div>

          <Link
            to="/admin/bookings"
            className="admin-btn admin-btn-secondary admin-btn-sm"
          >
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="admin-loading">
            <span className="admin-spinner" />
            <div>Loading bookings…</div>
          </div>
        ) : recentBookings.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">▤</div>
            <h3>No bookings yet</h3>
            <p>
              New customer bookings will appear here when
              they are recorded.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Movie</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentBookings.map((booking) => {
                  const status = getBookingStatus(booking);

                  const customer =
                    booking?.user?.name ||
                    booking?.customer?.name ||
                    booking?.userName ||
                    booking?.customerName ||
                    booking?.user?.email ||
                    "Customer";

                  const movie =
                    booking?.movie?.title ||
                    booking?.showtime?.movie?.title ||
                    booking?.movieTitle ||
                    "Movie booking";

                  const amount =
                    booking?.totalAmount ??
                    booking?.totalPrice ??
                    booking?.amount ??
                    0;

                  return (
                    <tr key={getId(booking)}>
                      <td className="admin-cell-primary">
                        #{String(getId(booking)).slice(-8)}
                      </td>

                      <td>
                        <strong>{customer}</strong>
                      </td>

                      <td>{movie}</td>

                      <td>
                        {getDate(
                          booking?.createdAt ||
                          booking?.bookingDate
                        )}
                      </td>

                      <td>{formatMoney(amount)}</td>

                      <td>
                        <span
                          className={`admin-status ${statusClass(status)}`}
                        >
                          {status.charAt(0).toUpperCase() +
                            status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
