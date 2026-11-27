import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api.js";
import "../../styles/MyBookings.css";

export default function BookingConfirmation() {
  const { id } = useParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    api(`/bookings/${id}`)
      .then((data) => {
        if (!cancelled) setBooking(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Unable to load your booking.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(resetTimer.current);
    };
  }, [id]);

  async function copyReference() {
    if (!booking?.bookingReference) return;

    try {
      await navigator.clipboard.writeText(booking.bookingReference);
      setCopied(true);

      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return <div className="bookings-page-wrapper">Loading your ticket...</div>;
  }

  if (error || !booking) {
    return (
      <div className="bookings-page-wrapper">
        <p role="alert">{error || "Booking not found."}</p>
        <Link to="/my-bookings">View My Bookings</Link>
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    booking.bookingReference
  )}`;

  const amount = Number(booking.totalAmount);

  return (
    <div className="bookings-page-wrapper">
      <section className="bookings-page-container">
        <span className="eyebrow">BOOKING CONFIRMED</span>
        <h1>You are all set!</h1>

        {booking.movie?.title && (
          <h2 className="movie-title">{booking.movie.title}</h2>
        )}

        {booking.showtime?.date && (
          <p className="movie-meta">
            {booking.showtime.date}
            {booking.showtime.startTime ? ` · ${booking.showtime.startTime}` : ""}
            {booking.hall?.name ? ` · ${booking.hall.name}` : ""}
          </p>
        )}

        <div className="qr-box">
          <img src={qrUrl} alt="Booking QR Code" className="qr-image" />
        </div>

        <div className="ticket-info-grid">
          <div>
            <span className="info-label">Booking reference</span>
            <button
              type="button"
              className="ref-number"
              title="Click to copy"
              onClick={copyReference}
            >
              <strong>{booking.bookingReference}</strong>
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>

          <div>
            <span className="info-label">Seats</span>
            <strong className="info-val">{(booking.seats || []).join(", ")}</strong>
          </div>

          <div>
            <span className="info-label">Total</span>
            <strong className="info-val price">
              {Number.isFinite(amount) ? `RM ${amount.toFixed(2)}` : "RM —"}
            </strong>
          </div>

          <div>
            <span className="info-label">Status</span>
            <strong className="info-val">{booking.status}</strong>
          </div>
        </div>

        <Link to="/my-bookings" className="btn-modify">
          View My Bookings
        </Link>
      </section>
    </div>
  );
}