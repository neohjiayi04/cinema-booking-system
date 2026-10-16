export default function SeatMap({ rows, seatsPerRow, bookedSeats, selectedSeats, onToggle }) {
  const rowElements = [];

  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    const rowSeats = [];

    for (let s = 1; s <= seatsPerRow; s++) {
      const seat = `${rowLabel}${String(s).padStart(2, "0")}`;
      const booked = bookedSeats.includes(seat);
      const selected = selectedSeats.includes(seat);

      rowSeats.push(
        <button
          key={seat}
          className={`seat ${booked ? "booked" : selected ? "selected" : "available"}`}
          disabled={booked}
          onClick={() => onToggle(seat)}
          title={`Seat ${seat} - ${booked ? "Booked" : selected ? "Selected" : "Available"}`}
        >
          {String(s).padStart(2, "0")}
        </button>
      );
    }

    rowElements.push(
      <div key={rowLabel} className="seat-row">
        <span className="row-label">{rowLabel}</span>
        <div className="row-seats">{rowSeats}</div>
        <span className="row-label">{rowLabel}</span>
      </div>
    );
  }

  return (
    <div className="seat-map-container">
      {/* Curved Screen Element */}
      <div className="screen-wrapper">
        <div className="screen-curve" />
        <span className="screen-text">SCREEN</span>
      </div>

      {/* Grid Rows */}
      <div className="seat-grid">{rowElements}</div>

      {/* Styled Legend Bar */}
      <div className="seat-legend">
        <div className="legend-item">
          <span className="legend-badge available" />
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge selected" />
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge booked" />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}