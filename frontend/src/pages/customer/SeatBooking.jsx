import { useCallback, useEffect, useMemo, useState } from "react";
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

  const fetchShowtime = useCallback(async () => {
    return api(`/showtimes/${id}`);
  }, [id]);

  function applyShowtimeData(data) {
    setShowtime(data);
    setBookedSeats(data.bookedSeats || []);

    // Remove seats from the current selection if they are already booked.
    setSelectedSeats((prev) =>
      prev.filter((seat) => !(data.bookedSeats || []).includes(seat))
    );

    return data;
  }

  useEffect(() => {
    let socket;
    let cancelled = false;

    async function loadInitialShowtime() {
      try {
        const data = await fetchShowtime();

        if (!cancelled) {
          applyShowtimeData(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
        }
      }
    }

    loadInitialShowtime();

    socket = connectShowtime(id, (message) => {
      console.log("WebSocket message received:", message);

      if (
        message.type === "CONNECTED" ||
        message.type === "JOINED_SHOWTIME"
      ) {
        setConnected(true);
      }

      if (message.type === "SEAT_BOOKED") {
        const seats = message.seats || [];

        setBookedSeats((prev) => [
          ...new Set([...prev, ...seats]),
        ]);

        setSelectedSeats((prev) =>
          prev.filter((seat) => !seats.includes(seat))
        );
      }

      if (message.type === "SEATS_UPDATED") {
        const seats = message.seats || [];

        setBookedSeats((prev) => [
          ...new Set([...prev, ...seats]),
        ]);

        setSelectedSeats((prev) =>
          prev.filter((seat) => !seats.includes(seat))
        );
      }

      if (message.type === "SEATS_RELEASED") {
        const seats = message.seats || [];

        setBookedSeats((prev) =>
          prev.filter((seat) => !seats.includes(seat))
        );
      }
    });

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [id, fetchShowtime]);

  function toggleSeat(seat) {
    if (bookedSeats.includes(seat)) {
      return;
    }

    setSelectedSeats((prev) =>
      prev.includes(seat)
        ? prev.filter((s) => s !== seat)
        : [...prev, seat]
    );

    setError("");
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
        body: JSON.stringify({
          showtimeId: id,
          seats: selectedSeats,
        }),
      });

      navigate(`/booking-confirmation/${booking._id}`);
    } catch (err) {
      const message = err.message || "Failed to confirm booking.";

      // If another customer booked one of the selected seats first,
      // refresh the showtime data automatically.
      if (message.toLowerCase().includes("just been booked")) {
        try {
          const latestShowtime = await fetchShowtime();
          applyShowtimeData(latestShowtime);

          setSelectedSeats((prev) =>
            prev.filter(
              (seat) => !(latestShowtime.bookedSeats || []).includes(seat)
            )
          );

          setError(
            "Some selected seats were just booked by another customer. The seat map has been updated."
          );
        } catch (refreshError) {
          setError(
            refreshError.message ||
              "The seats changed while you were booking. Please try again."
          );
        }
      } else {
        setError(message);
      }

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
        <Link
          to={`/movies/${showtime.movie._id || showtime.movieId}`}
          className="back-link"
        >
          ← Back to movie details
        </Link>
      </div>

      {/* HEADER SECTION */}
      <div className="booking-header">
        <div className="header-info">
          <span className="eyebrow">SELECT YOUR SEATS</span>

          <h1>{showtime.movie.title}</h1>

          <p className="showtime-meta">
            <span>{showtime.date}</span>
            <span className="dot">•</span>
            <span>{showtime.startTime}</span>
            <span className="dot">•</span>
            <span className="hall-pill">{showtime.hall.name}</span>
          </p>
        </div>

        {/* Live WebSocket Status Pill */}
        <div className="connection-status">
          <span
            className={`status-badge ${
              connected ? "live" : "offline"
            }`}
          >
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

      {/* ERROR / STATUS FEEDBACK */}
      {error && <p className="booking-error-banner">{error}</p>}

      {/* BOOKING SUMMARY BAR */}
      <div className="booking-summary-bar">
        <div className="summary-left">
          <div className="seat-count-display">
            <strong>{selectedSeats.length}</strong>
            <span>
              {selectedSeats.length === 1 ? "SEAT" : "SEATS"} SELECTED
            </span>
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
            <p className="no-seats-hint">
              Tap on available seats to reserve
            </p>
          )}
        </div>

        <div className="summary-right">
          <div className="price-tag-group">
            <span className="price-label">TOTAL PRICE</span>
            <span className="summary-price">
              RM {total.toFixed(2)}
            </span>
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