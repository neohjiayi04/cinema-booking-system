import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api.js";
import "../../styles/AdminBookings.css";

function formatDate(date) {
  if (!date) return "—";

  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount) {
  return `RM ${Number(amount || 0).toFixed(2)}`;
}

function getStatus(status) {
  return String(status || "UNKNOWN").toUpperCase();
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [movieFilter, setMovieFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await api("/bookings");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const confirmedBookings = bookings.filter(
    (booking) => getStatus(booking.status) === "CONFIRMED"
  );

  const cancelledBookings = bookings.filter(
    (booking) => getStatus(booking.status) === "CANCELLED"
  );

  const confirmedRevenue = confirmedBookings.reduce(
    (total, booking) => total + Number(booking.totalAmount || 0),
    0
  );

  const movieOptions = useMemo(() => {
    return [...new Set(
      bookings
        .map((booking) => booking.movie?.title)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const reference = String(booking.bookingReference || "").toLowerCase();
      const customer = String(booking.user?.name || "").toLowerCase();
      const email = String(booking.user?.email || "").toLowerCase();
      const movie = String(booking.movie?.title || "");
      const status = getStatus(booking.status);
      const showDate = String(booking.showtime?.date || "");

      const matchesSearch =
        !query ||
        reference.includes(query) ||
        customer.includes(query) ||
        email.includes(query) ||
        movie.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      const matchesMovie =
        movieFilter === "ALL" || movie === movieFilter;

      const matchesDate =
        !dateFilter || showDate === dateFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMovie &&
        matchesDate
      );
    });
  }, [bookings, search, statusFilter, movieFilter, dateFilter]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setMovieFilter("ALL");
    setDateFilter("");
  }

  return (
    <section className="admin-bookings-page">
      <div className="admin-page-header admin-bookings-header">
        <div>
          <h1>Bookings</h1>
          <p className="admin-page-description">
            Monitor customer reservations and booking records.
          </p>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!loading && !error && (
        <div className="booking-summary-grid">
          <article className="booking-summary-card">
            <span className="booking-summary-label">Total bookings</span>
            <strong>{bookings.length}</strong>
            <span className="booking-summary-note">All recorded reservations</span>
          </article>

          <article className="booking-summary-card">
            <span className="booking-summary-label">Confirmed bookings</span>
            <strong>{confirmedBookings.length}</strong>
            <span className="booking-summary-note">Active reservations</span>
          </article>

          <article className="booking-summary-card">
            <span className="booking-summary-label">Cancelled bookings</span>
            <strong>{cancelledBookings.length}</strong>
            <span className="booking-summary-note">Cancelled reservations</span>
          </article>

          <article className="booking-summary-card">
            <span className="booking-summary-label">Confirmed revenue</span>
            <strong>{formatAmount(confirmedRevenue)}</strong>
            <span className="booking-summary-note">
              Excludes cancelled bookings
            </span>
          </article>
        </div>
      )}

      <div className="admin-panel booking-management-panel">
        <div className="admin-panel-header booking-panel-heading">
          <div>
            <h2 className="admin-section-title">All Bookings</h2>
            <p className="admin-panel-subtitle">
              {loading
                ? "Loading booking records..."
                : `${filteredBookings.length} of ${bookings.length} bookings shown`}
            </p>
          </div>
        </div>

        {!loading && !error && bookings.length > 0 && (
          <div className="booking-filter-bar">
            <input
              type="search"
              className="booking-search-input"
              placeholder="Search reference, customer or movie..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="booking-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              className="booking-filter-select"
              value={movieFilter}
              onChange={(event) => setMovieFilter(event.target.value)}
            >
              <option value="ALL">All movies</option>
              {movieOptions.map((movie) => (
                <option key={movie} value={movie}>
                  {movie}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="booking-filter-date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filter by showtime date"
            />

            <button
              type="button"
              className="booking-clear-filters"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading bookings...</p>
          </div>
        ) : error ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon" aria-hidden="true">!</div>
            <h3>Could not load bookings</h3>
            <p>{error}</p>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={load}
            >
              Try again
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon" aria-hidden="true">▧</div>
            <h3>No bookings yet</h3>
            <p>
              Customer reservations will appear here when tickets are booked.
            </p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="admin-empty-state">
            <h3>No matching bookings</h3>
            <p>Try changing your search or filters.</p>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table booking-admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Movie</th>
                  <th>Showtime</th>
                  <th>Seats</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => {
                  const status = getStatus(booking.status);

                  return (
                    <tr key={booking._id}>
                      <td className="admin-cell-primary">
                        {booking.bookingReference || "—"}
                      </td>

                      <td>
                        <div className="booking-customer-cell">
                          <strong>{booking.user?.name || "Deleted user"}</strong>
                          {booking.user?.email && (
                            <span>{booking.user.email}</span>
                          )}
                        </div>
                      </td>

                      <td>{booking.movie?.title || "Deleted movie"}</td>

                      <td>
                        <div className="booking-showtime-cell">
                          <strong>
                            {formatDate(booking.showtime?.date)}
                          </strong>
                          <span>{booking.showtime?.startTime || "—"}</span>
                        </div>
                      </td>

                      <td>{(booking.seats || []).join(", ") || "—"}</td>

                      <td>
                        <strong>{formatAmount(booking.totalAmount)}</strong>
                      </td>

                      <td>
                        <span
                          className={`booking-admin-status ${status.toLowerCase()}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="booking-view-button"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBooking && (
        <div
          className="booking-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedBooking(null);
            }
          }}
        >
          <section
            className="booking-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-details-title"
          >
            <div className="booking-modal-header">
              <div>
                <span className="booking-modal-eyebrow">BOOKING DETAILS</span>
                <h2 id="booking-details-title">
                  {selectedBooking.bookingReference || "Reservation"}
                </h2>
              </div>

              <button
                type="button"
                className="booking-modal-close"
                onClick={() => setSelectedBooking(null)}
                aria-label="Close booking details"
              >
                ×
              </button>
            </div>

            <div className="booking-modal-content">
              <div className="booking-detail-row">
                <span>Booking status</span>
                <strong>
                  {getStatus(selectedBooking.status)}
                </strong>
              </div>

              <div className="booking-detail-row">
                <span>Customer</span>
                <strong>{selectedBooking.user?.name || "Deleted user"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Email</span>
                <strong>{selectedBooking.user?.email || "—"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Movie</span>
                <strong>{selectedBooking.movie?.title || "Deleted movie"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Showtime date</span>
                <strong>{formatDate(selectedBooking.showtime?.date)}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Showtime</span>
                <strong>{selectedBooking.showtime?.startTime || "—"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Seats</span>
                <strong>{(selectedBooking.seats || []).join(", ") || "—"}</strong>
              </div>

              <div className="booking-detail-row">
                <span>Amount</span>
                <strong>{formatAmount(selectedBooking.totalAmount)}</strong>
              </div>

              {selectedBooking.createdAt && (
                <div className="booking-detail-row">
                  <span>Booking created</span>
                  <strong>
                    {new Date(selectedBooking.createdAt).toLocaleString("en-MY")}
                  </strong>
                </div>
              )}
            </div>

            <div className="booking-modal-footer">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}