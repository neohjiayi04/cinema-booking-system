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

  return seats.every(seat => validSeats.has(seat));
}

export function calculateBookingTotal(numberOfSeats, pricePerSeat) {
  return numberOfSeats * Number(pricePerSeat);
}

const MAX_SEATS_PER_BOOKING = 6;

function validateSeatSelection(seatIds, max = MAX_SEATS_PER_BOOKING) {
  if (!Array.isArray(seatIds)) return { ok: false, error: "seatIds must be an array" };
  const unique = [...new Set(seatIds.map(String))];
  if (unique.length === 0) return { ok: false, error: "Choose at least one seat" };
  if (unique.length > max) return { ok: false, error: `Choose at most ${max} seats` };
  return { ok: true, seatIds: unique };
}
// add MAX_SEATS_PER_BOOKING and validateSeatSelection to this file's exports (same style as the others)