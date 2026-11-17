import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import SeatMap from "../../components/SeatMap.jsx";
import { api } from "../../services/api.js";
import { connectShowtime } from "../../services/websocket.js";
import "../../styles/SeatBooking.css";

export default function SeatBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showtime, setShowtime] = useState(null);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let socket;

    api(`/showtimes/${id}`)
      .then((data) => {
        setShowtime(data);
        setBookedSeats(data.bookedSeats || []);
      })
      .catch((e) => setError(e.message));

    socket = connectShowtime(id, (message) => {
      if (message.type === "CONNECTED" || message.type === "JOINED_SHOWTIME") {
        setConnected(true);
      }

      if (message.type === "SEAT_BOOKED") {
        setBookedSeats((prev) => [...new Set([...prev, ...message.seats])]);
        setSelectedSeats((prev) =>
          prev.filter((seat) => !message.seats.includes(seat))
        );
      }
    });

    return () => socket?.close();
  }, [id]);

  function toggleSeat(seat) {
    setSelectedSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]
    );
  }

  const total = useMemo(
    () => selectedSeats.length * Number(showtime?.price || 0),
    [selectedSeats, showtime]
  );

  async function confirm() {
    if (!selectedSeats.length || isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      const booking = await api("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId: id, seats: selectedSeats }),
      });
      navigate(`/booking-confirmation/${booking._id}`);
    } catch (err) {
      setError(err.message || "Failed to confirm booking.");
      setIsSubmitting(false);
    }
  }

  if (error && !showtime) {
    return (
      <div className="seat-booking-container">
        <div className="booking-state-card error-state">
          <p className="error">{error}</p>
          <Link to="/" className="btn-secondary">
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (!showtime) {
    return (
      <div className="seat-booking-container">
        <div className="booking-state-card">
          <div className="booking-loader" />
          <p>Preparing seating arrangements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seat-booking-container">
      {/* Background Ambient Glow */}
      <div className="booking-ambient-glow" />

      {/* Navigation Breadcrumb */}
      <div className="booking-nav-bar">
        <Link to={`/movies/${showtime.movie._id || showtime.movieId}`} className="back-link">
          ← Back to movie details
        </Link>
      </div>

      {/* HEADER SECTION */}
      <div className="booking-header">
        <div className="header-info">
          <span className="eyebrow">SELECT YOUR SEATS</span>
          <h1>{showtime.movie.title}</h1>
          <p className="showtime-meta">
            <span> {showtime.date}</span>
            <span className="dot">•</span>
            <span> {showtime.startTime}</span>
            <span className="dot">•</span>
            <span className="hall-pill">{showtime.hall.name}</span>
          </p>
        </div>

        {/* Live WebSocket Status Pill */}
        <div className="connection-status">
          <span className={`status-badge ${connected ? "live" : "offline"}`}>
            <span className="status-dot" />
            {connected ? "LIVE SEATING" : "CONNECTING"}
          </span>
        </div>
      </div>

      {/* SEAT MAP DISPLAY */}
      <div className="seat-map-wrapper">
        <SeatMap
          rows={showtime.hall.rows}
          seatsPerRow={showtime.hall.seatsPerRow}
          bookedSeats={bookedSeats}
          selectedSeats={selectedSeats}
          onToggle={toggleSeat}
        />
      </div>

      {/* ERROR FEEDBACK */}
      {error && <p className="booking-error-banner">{error}</p>}

      {/* FLOATING GLASSMOPHIC BOOKING SUMMARY BAR */}
      <div className="booking-summary-bar">
        <div className="summary-left">
          <div className="seat-count-display">
            <strong>{selectedSeats.length}</strong>
            <span>{selectedSeats.length === 1 ? "SEAT" : "SEATS"} SELECTED</span>
          </div>
          {selectedSeats.length > 0 ? (
            <div className="selected-seats-pills">
              {selectedSeats.map((seat) => (
                <span key={seat} className="seat-pill">
                  {seat}
                </span>
              ))}
            </div>
          ) : (
            <p className="no-seats-hint">Tap on available seats to reserve</p>
          )}
        </div>

        <div className="summary-right">
          <div className="price-tag-group">
            <span className="price-label">TOTAL PRICE</span>
            <span className="summary-price">RM {total.toFixed(2)}</span>
          </div>

          <button
            className="confirm-btn"
            disabled={!selectedSeats.length || isSubmitting}
            onClick={confirm}
          >
            {isSubmitting ? "Confirming..." : "Confirm Booking →"}
          </button>
        </div>
      </div>
    </div>
  );
}