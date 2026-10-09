import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    api("/bookings/my").then(setBookings);
  }, []);

  return (
    <section>
      <span className="eyebrow">ACCOUNT</span>
      <h1>My Bookings</h1>

      <div className="booking-list">
        {bookings.map(b => (
          <article className="booking-row" key={b._id}>
            <div>
              <strong>{b.movie.title}</strong>
              <span>{b.showtime.date} · {b.showtime.startTime} · {b.hall.name}</span>
            </div>
            <div>
              <strong>{b.seats.join(", ")}</strong>
              <span>{b.bookingReference}</span>
            </div>
            <strong>RM {b.totalAmount.toFixed(2)}</strong>
          </article>
        ))}
      </div>

      {!bookings.length && <p>No bookings yet.</p>}
    </section>
  );
}
