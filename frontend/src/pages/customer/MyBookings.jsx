import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import "../../styles/MyBookings.css";

function getBookingCategory(booking) {
  if (booking.status === "CANCELLED") {
    return "cancelled";
  }

  if (booking.status === "COMPLETED") {
    return "completed";
  }

  const date = booking.showtime?.date;
  const startTime = booking.showtime?.startTime;
  const duration = Number(booking.movie?.duration || 120);

  if (!date || !startTime) {
    return "upcoming";
  }

  // Cinema timezone: Malaysia (UTC+8)
  const startDateTime = new Date(`${date}T${startTime}:00+08:00`);
  const endDateTime = new Date(
    startDateTime.getTime() + duration * 60 * 1000
  );

  return endDateTime <= new Date() ? "completed" : "upcoming";
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [newSeats, setNewSeats] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  
  const fetchBookings = async () => {
    const data =await api("/bookings/my");
    setBookings(data);
    return data;
  };
  
  useEffect(() => {
    fetchBookings();
  }, []);

  // Add the filtered bookings based on the active tab
  const upcomingBookings = bookings.filter(
    (b) => getBookingCategory(b) === "upcoming"
  );

  const completedBookings = bookings.filter(
    (b) => getBookingCategory(b) === "completed"
  );

  const cancelledBookings = bookings.filter(
    (b) => getBookingCategory(b) === "cancelled"
  );

  const filteredBookings = {
    upcoming: upcomingBookings,
    completed: completedBookings,
    cancelled: cancelledBookings,
  }[activeTab];

  // DELETE operation
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      try {
        await api(`/bookings/${id}`, { method: "DELETE" });

        setBookings((prev) =>
          prev.map((b) =>
            b._id === id
              ? { ...b, status: "CANCELLED" }
              : b
          )
        );

        setEditingBooking(null);
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
      const updatedSeatArray =newSeats
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

      await api(`/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({seats:updatedSeatArray}),
      });
      
      //FEtch fully populated bookings after update
      await fetchBookings();

      setEditingBooking(null);
      setNewSeats("");
    }
    catch (err) {
      alert(err.message || "Failed to update booking.");
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
          <div className="booking-tabs">
            <button
              className={`booking-tab ${activeTab === "upcoming" ? "active" : ""}`}
              onClick={() => setActiveTab("upcoming")}
            >
              Upcoming
              <span>{upcomingBookings.length}</span>
            </button>

            <button
              className={`booking-tab ${activeTab === "completed" ? "active" : ""}`}
              onClick={() => setActiveTab("completed")}
            >
              Completed
              <span>{completedBookings.length}</span>
            </button>

            <button
              className={`booking-tab ${activeTab === "cancelled" ? "active" : ""}`}
              onClick={() => setActiveTab("cancelled")}
            >
              Cancelled
              <span>{cancelledBookings.length}</span>
            </button>
          </div>
        </div>

        {/* Bookings Container */}
        <div className="booking-list">
          {filteredBookings.map((b) => {
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
                    <span className={`booking-status-pill ${getBookingCategory(b)}`}>
                      <span className="status-dot"></span>
                      {getBookingCategory(b) === "upcoming"
                        ? "Confirmed"
                        : getBookingCategory(b) === "completed"
                        ? "Completed"
                        : "Cancelled"}
                    </span>

                    <span className="ref-number">
                      Ref #{b.bookingReference}
                    </span>
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
                    {getBookingCategory(b) === "upcoming" ? (
                      editingBooking === b._id ? (
                        <div className="edit-btn-group">
                          <button
                            className="btn-save"
                            onClick={() => handleUpdateSubmit(b._id)}
                          >
                            Save
                          </button>

                          <button
                            className="btn-cancel-edit"
                            onClick={() => {
                              setEditingBooking(null);
                              setNewSeats("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="btn-modify"
                            onClick={() => handleEditClick(b)}
                          >
                            Modify Seats
                          </button>

                          <button
                            className="btn-delete"
                            onClick={() => handleDelete(b._id)}
                          >
                            Cancel Pass
                          </button>
                        </>
                      )
                    ) : (
                      <span className="ticket-history-label">
                        {getBookingCategory(b) === "completed"
                          ? "Showtime Completed"
                          : "Booking Cancelled"}
                      </span>
                    )}
                  </div>
                </div>

              </article>
            );
          })}
        </div>

        {filteredBookings.length === 0 && (
          <div className="empty-state">
            <p>
              {activeTab === "upcoming"
                ? "You have no upcoming bookings."
                : activeTab === "completed"
                ? "You have no completed movie tickets yet."
                : "You have no cancelled bookings."}
            </p>
          </div>
        )}

      </section>
    </div>
  );
}