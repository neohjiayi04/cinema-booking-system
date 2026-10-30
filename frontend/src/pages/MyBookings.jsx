import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import "../styles/MyBookings.css";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [newSeats, setNewSeats] = useState("");
  
  const fetchBookings = () => {
    api("/bookings/my").then(setBookings);
  };
  
  useEffect(() => {
    fetchBookings();
  }, []);

  // DELETE operation
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      try {
        await api(`/bookings/${id}`, { method: "DELETE" });
        setBookings(bookings.filter((b) => b._id !== id));
      } catch (err) {
        alert(err.message || "Failed to cancel booking.");
      }
    }
  };

  // UPDATE operation
  const handleEditClick = (booking) => {
    setEditingBooking(booking._id);
    setNewSeats(booking.seats.join(", "));
  };

  const handleUpdateSubmit = async (id) => {
    try {
      const updatedSeatsArray = newSeats.split(",").map((s) => s.trim());
      const response = await api(`/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ seats: updatedSeatsArray }),
      });

      setBookings(bookings.map((b) => (b._id === id ? response : b)));
      setEditingBooking(null);
    } catch (err) {
      alert(err.message || "Failed to update seats.");
    }
  };

  return (
    <div className="bookings-page-wrapper">
      <section className="bookings-page-container">
        
        {/* Page Title Header */}
        <div className="bookings-header">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h1>My Bookings & Reservations</h1>
            <p className="sub-description">
              Manage movie digital passes, update seat selections, or request cancellations.
            </p>
          </div>
          <div className="header-badge-group">
            <span className="filter-pill active">
              Bookings <span className="pill-count">{bookings.length}</span>
            </span>
          </div>
        </div>

        {/* Bookings Container */}
        <div className="booking-list">
          {bookings.map((b) => {
            // Generate QR Code dynamic URL
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
              b.bookingReference
            )}`;

            return (
              <article className="ticket-card" key={b._id}>
                
                {/* 1. Poster Thumbnail */}
                <div className="ticket-poster-container">
                  <img
                    src={
                      b.movie?.poster ||
                      b.movie?.posterUrl ||
                      "https://placehold.co/150x220?text=No+Poster"
                    }
                    alt={b.movie?.title || "Movie"}
                    className="ticket-poster"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src =
                        "https://placehold.co/150x220?text=No+Poster";
                    }}
                  />
                </div>

                {/* 2. Main Ticket Details */}
                <div className="ticket-details">
                  <div className="ticket-status-row">
                    <span className="confirmed-pill">
                      <span className="status-dot"></span> Confirmed
                    </span>
                    <span className="ref-number">Ref #{b.bookingReference}</span>
                  </div>

                  <h2 className="movie-title">{b.movie?.title || "Movie Ticket"}</h2>
                  <p className="movie-meta">Standard Admission · Cinema Display</p>

                  {/* Highlight Info Box */}
                  <div className="ticket-info-grid">
                    <div>
                      <span className="info-label">Date</span>
                      <strong className="info-val">{b.showtime?.date || "Today"}</strong>
                    </div>
                    <div>
                      <span className="info-label">Showtime</span>
                      <strong className="info-val">{b.showtime?.startTime || "--:--"}</strong>
                    </div>
                    <div>
                      <span className="info-label">Auditorium</span>
                      <strong className="info-val">{b.hall?.name || "Main Hall"}</strong>
                    </div>
                    <div>
                      <span className="info-label">Seats</span>
                      {editingBooking === b._id ? (
                        <input
                          type="text"
                          className="edit-seats-input"
                          value={newSeats}
                          onChange={(e) => setNewSeats(e.target.value)}
                        />
                      ) : (
                        <strong className="info-val">{b.seats?.join(", ")}</strong>
                      )}
                    </div>
                    <div>
                      <span className="info-label">Amount Paid</span>
                      <strong className="info-val price">RM {b.totalAmount.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Ticket Side Pass & Actions (QR Code) */}
                <div className="ticket-pass-section">
                  <div className="qr-box">
                    <img src={qrUrl} alt="Pass QR Code" className="qr-image" />
                  </div>
                  <span className="pass-caption">PASS CODE ACTIVE</span>

                  <div className="ticket-actions">
                    {editingBooking === b._id ? (
                      <div className="edit-btn-group">
                        <button className="btn-save" onClick={() => handleUpdateSubmit(b._id)}>
                          Save
                        </button>
                        <button className="btn-cancel-edit" onClick={() => setEditingBooking(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button className="btn-modify" onClick={() => handleEditClick(b)}>
                          Modify Seats
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(b._id)}>
                          Cancel Pass
                        </button>
                      </>
                    )}
                  </div>
                </div>

              </article>
            );
          })}
        </div>

        {!bookings.length && (
          <div className="empty-state">
            <p>No active movie bookings found.</p>
          </div>
        )}

      </section>
    </div>
  );
}