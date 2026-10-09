import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api.js";

export default function BookingConfirmation() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    api(`/bookings/${id}`).then(setBooking);
  }, [id]);

  if (!booking) return <p>Loading...</p>;

  return (
    <section className="confirmation">
      <span className="success-icon">✓</span>
      <span className="eyebrow">BOOKING CONFIRMED</span>
      <h1>You're all set.</h1>
      <p>Your booking reference is <strong>{booking.bookingReference}</strong></p>

      <div className="confirmation-card">
        <div><span>Seats</span><strong>{booking.seats.join(", ")}</strong></div>
        <div><span>Total</span><strong>RM {booking.totalAmount.toFixed(2)}</strong></div>
        <div><span>Status</span><strong>{booking.status}</strong></div>
      </div>

      <Link className="button" to="/my-bookings">View My Bookings</Link>
    </section>
  );
}
