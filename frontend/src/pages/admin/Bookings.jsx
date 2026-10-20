import { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);

  useEffect(() => { api("/bookings").then(setBookings); }, []);

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
      <div className="table">
        {bookings.map(b => (
          <div className="table-row" key={b._id}>
            <strong>{b.bookingReference}</strong>
            <span>{b.user.name}</span>
            <span>{b.movie.title}</span>
            <span>{b.seats.join(", ")}</span>
            <span>RM {b.totalAmount}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
