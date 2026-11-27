import { config } from "../config.js";
import { generateValidSeats } from "./seatUtils.js";

export const HALL_STATUS = Object.freeze({ 
  ACTIVE: "ACTIVE", 
  MAINTENANCE: "MAINTENANCE", 
  INACTIVE: "INACTIVE" 
});

/* ------------------------------ time ------------------------------ */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value) => typeof value === "string" && TIME_RE.test(value);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = (value) => String(value).slice(0, 10);

export function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Minutes since the epoch for a date (YYYY-MM-DD) and time (HH:MM). */
export function toMinutes(date, time) {
  return Date.parse(`${day(date)}T${time}:00Z`) / 60000;
}

/** The day before, the day itself and the day after (YYYY-MM-DD each). */
export function neighbouringDates(date) {
  const base = Date.parse(`${day(date)}T00:00:00Z`);
  return [-1, 0, 1].map(offset =>
    new Date(base + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
}

/** HH:MM for a value from toMinutes(). */
export function formatMinutes(total) {
  return new Date(total * 60000).toISOString().slice(11, 16);
}

/** The current date (YYYY-MM-DD) and time (HH:MM) in the cinema's time zone. */
export function nowInCinema(now = new Date(), timeZone = config.timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, second: parts.second };
}

const stamp = (date, time, second = "00") => `${day(date)} ${time}:${String(second).padStart(2, "0")}`;

/** True when the showtime starts before "now" (cinema time). */
export function isShowtimePast(date, startTime, now = new Date()) {
  const current = nowInCinema(now);
  return stamp(date, startTime) < stamp(current.date, current.time, current.second);
}

/** True for the showtime that starts now or later. */
export function isShowtimeUpcoming(showtime, now = new Date()) {
  return !isShowtimePast(showtime.date, showtime.startTime, now);
}

/* ------------------------------ halls ------------------------------ */
export const hallStatus = (hall) => {
  const status = String(hall?.status ?? HALL_STATUS.ACTIVE).toUpperCase();

  return Object.values(HALL_STATUS).includes(status)
    ? status
    : HALL_STATUS.ACTIVE;
};

export const hallCapacity = (hall) => 
  Number(hall.rows) * Number(hall.seatsPerRow);

export function hallCleaningMinutes(hall) {
  const own = hall?.cleaningMinutes;
  return Number.isFinite(own) && own >= 0 ? own : config.showtimeCleaningMinutes;
}

/** Adds the calculated status, cleaning time and capacity to a hall document. */
export function decorateHall(hall) {
  return {
    ...hall,
    status: hallStatus(hall),
    cleaningMinutes: hallCleaningMinutes(hall),
    capacity: hallCapacity(hall)
  };
}

export function pickHallFields(body = {}) {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.rows !== undefined) out.rows = Number(body.rows);
  if (body.seatsPerRow !== undefined) out.seatsPerRow = Number(body.seatsPerRow);
  if (body.cleaningMinutes !== undefined && body.cleaningMinutes !== "") {
    out.cleaningMinutes = Number(body.cleaningMinutes);
  }
  if (body.status !== undefined) out.status = String(body.status).toUpperCase();
  return out;
}

/** Returns an error message, or null when the hall is valid. */
export function validateHall(hall) {
  if (!hall.name) return "Hall name is required.";
  if (hall.name.length > 60) return "Hall name must be 60 characters or fewer.";
  // Seats are lettered A-Z, so a hall can have at most 26 rows.
  if (!Number.isInteger(hall.rows) || hall.rows < 1 || hall.rows > 26) {
    return "Rows must be a whole number from 1 to 26.";
  }
  if (!Number.isInteger(hall.seatsPerRow) || hall.seatsPerRow < 1 || hall.seatsPerRow > 50) {
    return "Seats per row must be a whole number from 1 to 50.";
  }
  if (
    hall.cleaningMinutes !== undefined &&
    (!Number.isInteger(hall.cleaningMinutes) || hall.cleaningMinutes < 0 || hall.cleaningMinutes > 30)
  ) {
    return "Cleaning time must be a whole number of minutes from 0 to 30.";
  }
  if (hall.status !== undefined && !Object.values(HALL_STATUS).includes(hall.status)) {
    return "Hall status must be ACTIVE, MAINTENANCE, or INACTIVE.";
  }
  return null;
}

/** Seats from `seats` that don't exist in a hall of this size. */
export function seatsOutsideLayout(seats, rows, seatsPerRow) {
  const valid = generateValidSeats(rows, seatsPerRow);
  return [...new Set(seats)].filter((seat) => !valid.has(seat));
}

/* ----------------------------- overlaps ----------------------------- */
/**
 * A showing occupies its hall from its start until it ends plus the cleaning time.
 * Example: ends 12:00 + 20 min cleaning -> the next showing may start at 12:20.
 * Two showings clash when those occupied windows overlap at all (partial overlaps
 * included); one starting exactly when the other's window ends is fine.
 */
export function showtimeWindow({ date, startTime, duration }, cleaningMinutes) {
  const start = toMinutes(date, startTime);
  const end = start + Number(duration);
  return { start, end, free: end + cleaningMinutes };
}

/**
 * candidate / others: { date, startTime, duration, title? }
 * Returns { showtime, window } for the first clash, or null.
 */
export function findShowtimeConflict(candidate, others, cleaningMinutes) {
  const mine = showtimeWindow(candidate, cleaningMinutes);

  for (const other of others) {
    const theirs = showtimeWindow(other, cleaningMinutes);
    if (mine.start < theirs.free && theirs.start < mine.free) {
      return { showtime: other, window: theirs, candidate: mine };
    }
  }
  return null;
}

export function conflictMessage(hall, conflict, cleaningMinutes) {
  const { showtime, window, candidate } = conflict;
  const title = showtime.title ? `"${showtime.title}"` : "another movie";
  const range = `${formatMinutes(window.start)}-${formatMinutes(window.end)}`;
  const cleaning = cleaningMinutes ? ` plus ${cleaningMinutes} min cleaning` : "";
  const base = `${hall.name} is already in use by ${title} on ${day(showtime.date)} (${range}${cleaning}).`;

  return candidate.start >= window.start
    ? `${base} The next movie can start at ${formatMinutes(window.free)}.`
    : `${base} This showing (plus cleaning) would run into it, so it must finish by ${formatMinutes(window.start - cleaningMinutes)}.`;
}