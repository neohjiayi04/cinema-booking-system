import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SeatMap from "../components/SeatMap.jsx";
import { api } from "../services/api.js";
import { connectShowtime } from "../services/websocket.js";

export default function SeatBooking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showtime, setShowtime] = useState(null);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket;

    api(`/showtimes/${id}`)
      .then(data => {
        setShowtime(data);
        setBookedSeats(data.bookedSeats || []);
      })
      .catch(e => setError(e.message));

    socket = connectShowtime(id, message => {
      if (message.type === "CONNECTED" || message.type === "JOINED_SHOWTIME") {
        setConnected(true);
      }

      if (message.type === "SEAT_BOOKED") {
        setBookedSeats(prev => [...new Set([...prev, ...message.seats])]);
        setSelectedSeats(prev => prev.filter(seat => !message.seats.includes(seat)));
      }
    });

    return () => socket?.close();
  }, [id]);

  function toggleSeat(seat) {
    setSelectedSeats(prev =>
      prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]
    );
  }

  const total = useMemo(
    () => selectedSeats.length * Number(showtime?.price || 0),
    [selectedSeats, showtime]
  );

  async function confirm() {
    if (!selectedSeats.length) return;
    setError("");

    try {
      const booking = await api("/bookings", {
        method: "POST",
        body: JSON.stringify({ showtimeId: id, seats: selectedSeats })
      });
      navigate(`/booking-confirmation/${booking._id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !showtime) return <p className="error">{error}</p>;
  if (!showtime) return <p>Loading seat map...</p>;

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">SELECT YOUR SEATS</span>
          <h1>{showtime.movie.title}</h1>
          <p>{showtime.date} · {showtime.startTime} · {showtime.hall.name}</p>
        </div>
        <span className={connected ? "live" : "offline"}>
          ● {connected ? "LIVE" : "CONNECTING"}
        </span>
      </div>

      <SeatMap
        rows={showtime.hall.rows}
        seatsPerRow={showtime.hall.seatsPerRow}
        bookedSeats={bookedSeats}
        selectedSeats={selectedSeats}
        onToggle={toggleSeat}
      />

      {error && <p className="error">{error}</p>}

      <div className="booking-summary">
        <div>
          <strong>{selectedSeats.length}</strong> seat(s) selected
          {selectedSeats.length > 0 && <p>{selectedSeats.join(", ")}</p>}
        </div>
        <div className="summary-price">RM {total.toFixed(2)}</div>
        <button className="button" disabled={!selectedSeats.length} onClick={confirm}>
          Confirm Booking
        </button>
      </div>
    </section>
  );
}
