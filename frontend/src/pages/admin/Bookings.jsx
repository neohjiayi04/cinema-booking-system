import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setBookings(await api("/bookings"));
    } catch (err) {
      setError(err.message || "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section>
      <div className="admin-page-header">
        <div>
          <h1>Bookings</h1>
          <p className="admin-page-description">
            Manage and view all cinema bookings.
          </p>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2 className="admin-section-title">All Bookings</h2>
            <p className="admin-panel-subtitle">
              {loading
                ? "Loading..."
                : `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"} recorded`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <p>Loading bookings...</p>
          </div>
        ) : error ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon" aria-hidden="true">!</div>
            <h3>Couldn't load bookings</h3>
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
              When customers book tickets, their reservations will appear here.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Movie</th>
                  <th>Seats</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id}>
                    <td className="admin-cell-primary">{b.bookingReference}</td>
                    <td>{b.user?.name ?? "Deleted user"}</td>
                    <td>{b.movie?.title ?? "Deleted movie"}</td>
                    <td>{(b.seats ?? []).join(", ")}</td>
                    <td>
                      <strong>RM {Number(b.totalAmount).toFixed(2)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}