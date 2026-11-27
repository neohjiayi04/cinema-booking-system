import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api.js";
import "../../styles/BookingConfirmation.css";

export default function BookingConfirmation() {
  const { id } = useParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
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
    return <div className="confirm-page confirm-state">Loading your ticket...</div>;
  }

  if (error || !booking) {
    return (
      <div className="confirm-page confirm-state">
        <div>
          <p role="alert">{error || "Booking not found."}</p>
          <Link to="/my-bookings">View My Bookings</Link>
        </div>
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    booking.bookingReference
  )}`;

  const amount = Number(booking.totalAmount);
  const cancelled = booking.status === "CANCELLED";

  return (
    <div className="confirm-page">
      <section className="confirm-card">
        <header className="confirm-header">
          <div className="confirm-check" aria-hidden="true">✓</div>
          <span className="confirm-eyebrow">BOOKING CONFIRMED</span>
          <h1 className="confirm-title">You are all set!</h1>
        </header>

        {booking.movie?.title && (
          <div className="confirm-movie">
            <h2 className="confirm-movie-title">{booking.movie.title}</h2>
            {booking.showtime?.date && (
              <p className="confirm-movie-meta">
                {booking.showtime.date}
                {booking.showtime.startTime ? ` · ${booking.showtime.startTime}` : ""}
                {booking.hall?.name ? ` · ${booking.hall.name}` : ""}
              </p>
            )}
          </div>
        )}

        <div className="confirm-body">
          <div className="confirm-qr">
            <div className="confirm-qr-box">
              {qrFailed ? (
                <div className="confirm-qr-fallback">
                  QR code unavailable. Show this booking reference at the entrance.
                </div>
              ) : (
                <img
                  src={qrUrl}
                  alt="Booking QR Code"
                  className="confirm-qr-image"
                  onError={() => setQrFailed(true)}
                />
              )}
            </div>
            <span className="confirm-qr-caption">SCAN AT ENTRANCE</span>
          </div>

          <dl className="confirm-details">
            <div className="confirm-detail is-wide">
              <dt className="confirm-label">Booking reference</dt>
              <dd>
                <button
                  type="button"
                  className="confirm-ref"
                  title="Click to copy"
                  onClick={copyReference}
                >
                  <strong>{booking.bookingReference}</strong>
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </dd>
            </div>

            <div className="confirm-detail">
              <dt className="confirm-label">Seats</dt>
              <dd className="confirm-value">{(booking.seats || []).join(", ")}</dd>
            </div>

            <div className="confirm-detail">
              <dt className="confirm-label">Total</dt>
              <dd className="confirm-value is-price">
                {Number.isFinite(amount) ? `RM ${amount.toFixed(2)}` : "RM —"}
              </dd>
            </div>

            <div className="confirm-detail">
              <dt className="confirm-label">Status</dt>
              <dd>
                <span className={`confirm-status${cancelled ? " is-cancelled" : ""}`}>
                  {booking.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <footer className="confirm-footer">
          <Link to="/my-bookings" className="confirm-action">
            View My Bookings
          </Link>
        </footer>
      </section>
    </div>
  );
}
