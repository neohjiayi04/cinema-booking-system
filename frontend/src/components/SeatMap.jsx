export default function SeatMap({ rows, seatsPerRow, bookedSeats, selectedSeats, onToggle }) {
  const seats = [];

  for (let r = 0; r < rows; r++) {
    const row = String.fromCharCode(65 + r);

    for (let s = 1; s <= seatsPerRow; s++) {
      const seat = `${row}${String(s).padStart(2, "0")}`;
      const booked = bookedSeats.includes(seat);
      const selected = selectedSeats.includes(seat);

      seats.push(
        <button
          key={seat}
          className={`seat ${booked ? "booked" : selected ? "selected" : ""}`}
          disabled={booked}
          onClick={() => onToggle(seat)}
          title={booked ? "Booked" : selected ? "Selected" : "Available"}
        >
          {seat}
        </button>
      );
    }
  }

  return (
    <div className="seat-map">
      <div className="screen">SCREEN</div>
      <div className="seat-grid">{seats}</div>
      <div className="legend">
        <span>🟩 Available</span>
        <span>🟨 Selected</span>
        <span>🟥 Booked</span>
      </div>
    </div>
  );
}
