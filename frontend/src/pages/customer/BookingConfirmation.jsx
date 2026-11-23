import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../services/api.js";
import "../../styles/BookingConfirmation.css";

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/bookings/${id}`).then(setBooking);
  }, [id]);

  const handleCopy = () => {
    if (booking?.bookingReference) {
      navigator.clipboard.writeText(booking.bookingReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!booking) return <div className="loading-state">Loading your ticket...</div>;

  // Generate a dynamic QR code URL using the booking reference
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    booking.bookingReference
  )}`;

  return (
    <section className="confirmation-wrapper">
      <div className="confirmation-container">
        
        {/* Left Section: Details & CTA */}
        <div className="confirmation-content">
          <div className="success-badge">
            <span className="success-icon">✓</span>
          </div>
          <span className="eyebrow">BOOKING CONFIRMED</span>
          <h1>You are all set!</h1>
          <p className="subtext">
            Your booking reference is{" "}
            <button className="copy-ref-btn" onClick={handleCopy} title="Click to copy">
              <strong>{booking.bookingReference}</strong>
              <span className={`copy-tooltip ${copied ? "show" : ""}`}>
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>
          </p>

          <div className="action-group">
            <Link className="primary-button" to="/my-bookings">
              View My Bookings
            </Link>
          </div>
        </div>

        {/* Right Section: Ticket Stub Card with QR Code */}
        <div className="confirmation-card">
          <div className="ticket-header">
            <span className="ticket-tag">E-Ticket Summary</span>
            <span className="live-pulse"></span>
          </div>

          <div className="ticket-body">
            <div className="ticket-row">
              <span>Seats</span>
              <strong>{booking.seats.join(", ")}</strong>
            </div>
            <div className="ticket-row">
              <span>Total Amount</span>
              <strong className="price-highlight">RM {booking.totalAmount.toFixed(2)}</strong>
            </div>
            <div className="ticket-row">
              <span>Status</span>
              <span className="status-pill">{booking.status}</span>
            </div>
          </div>

          {/* QR Code Footer Section */}
          <div className="ticket-footer">
            <div className="qr-container">
              <img src={qrCodeUrl} alt="Booking QR Code" className="ticket-qr-code" />
            </div>
            <span className="scan-instruction">Scan to check-in</span>
          </div>
        </div>

      </div>
    </section>
  );
}