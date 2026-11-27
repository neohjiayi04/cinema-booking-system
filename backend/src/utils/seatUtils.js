export function generateValidSeats(rows, seatsPerRow) {
  const validSeats = new Set();

  for (let r = 0; r < rows; r++) {
    const row = String.fromCharCode(65 + r);

    for (let s = 1; s <= seatsPerRow; s++) {
      validSeats.add(`${row}${String(s).padStart(2, "0")}`);
    }
  }

  return validSeats;
}

export function validateSeats(seats, rows, seatsPerRow) {
  if (!Array.isArray(seats) || seats.length === 0) {
    return false;
  }

  const validSeats = generateValidSeats(rows, seatsPerRow);

  return seats.every((seat) => validSeats.has(seat));
}

export function calculateBookingTotal(numberOfSeats, pricePerSeat) {
  return numberOfSeats * Number(pricePerSeat);
}