// Seat maths + the ONE place that knows what your API's seat objects look like.
export const SCREEN_W = 11.5;               // screen width in metres
export const SCREEN_CENTER = [0, 3.4, 0];
export const ROW_STEP = 0.2;                // each row sits this much higher than the one in front
export const EYE_HEIGHT = 1.05;
export const MAX_SEATS = 6;

export const floorHeight = (rowIndex) => ROW_STEP * (rowIndex + 1);

/**
 * ADAPTER: turns one seat from YOUR backend into { id, row, number, taken, price, type }.
 * If your field names differ, change this function (or pass your own `adapt` prop). Nothing else needs to change.
 */
export function defaultAdapt(s) {
  const status = String(s.status ?? "").toLowerCase();
  const taken =
    s.isBooked === true || s.booked === true || s.isTaken === true ||
    ["booked", "taken", "sold", "reserved", "unavailable", "held"].includes(status);
  const row = String(s.row ?? s.rowLabel ?? s.seatRow ?? "");
  const number = Number(s.number ?? s.seatNumber ?? s.col ?? s.column);
  return {
    id: String(s._id ?? s.id ?? s.seatId ?? `${row}${number}`),
    row,
    number,
    taken,
    price: Number(s.price ?? s.seatPrice ?? 0),
    type: /recliner|vip|premium/i.test(String(s.type ?? s.seatType ?? "")) ? "RECLINER" : "STANDARD",
  };
}

/**
 * Adds label, rowIndex, x, y and status to every seat. x / y are metres, worked out from row and seat number,
 * so the backend does not need any new columns. The hall size is read from the seats themselves.
 */
export function normalizeSeats(rawSeats, adapt = defaultAdapt) {
  if (!Array.isArray(rawSeats) || rawSeats.length === 0) return [];
  const base = rawSeats.map((raw) => ({ ...adapt(raw), raw }));

  const rowLabels = [...new Set(base.map((s) => s.row))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const rowIndexOf = new Map(rowLabels.map((r, i) => [r, i]));
  const perRow = Math.max(...base.map((s) => s.number));
  const aisleAfter = Math.floor(perRow / 2);

  return base.map((s) => {
    const rowIndex = rowIndexOf.get(s.row);
    const side = s.number > aisleAfter ? 0.3 : -0.3;
    return {
      ...s,
      label: `${s.row}${s.number}`,
      rowIndex,
      aisleAfter,
      x: (s.number - 1 - (perRow - 1) / 2) * 0.9 + side,
      y: 4.2 + rowIndex * 1.1,
      status: s.taken ? "TAKEN" : "AVAILABLE",
    };
  });
}

// The "6.3 m / 86 degrees" numbers: distance from the screen centre and how much of your view the screen fills.
export function viewStats(seat) {
  const distance = Math.hypot(seat.x, seat.y);
  const angle = (2 * Math.atan(SCREEN_W / 2 / distance) * 180) / Math.PI;
  const label = angle > 75 ? "Up close" : angle > 50 ? "Full picture" : "Back row";
  return { distance: distance.toFixed(1), angle: Math.round(angle), label };
}

export function togetherNote(selected) {
  if (selected.length < 2) return "";
  const row = selected[0].row;
  if (!selected.every((s) => s.row === row)) return "Seats are in different rows";
  const nums = selected.map((s) => s.number).sort((a, b) => a - b);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return "Seats are split up";
  }
  const aisle = selected[0].aisleAfter;
  if (nums[0] <= aisle && nums[nums.length - 1] > aisle) return "Side by side, but split by the aisle";
  return "Seated together";
}