import { config } from "../config.js";
/* ------------------------------------------------------------------ *
 * Movie statuses
 *
 *   COMING_SOON  today is before the start (release) date
 *   NOW_SHOWING  today is inside the availability period
 *   ENDED        today is after the end date  -> "Previously Shown"
 *   ARCHIVED     hidden from customers (manual, or automatic after a while)
 *
 * Only ARCHIVED is stored (as `archived: true`). The other three are always
 * calculated from the dates, so they can never go stale.
 * ------------------------------------------------------------------ */
export const MOVIE_STATUS = Object.freeze({
  COMING_SOON: "COMING_SOON",
  NOW_SHOWING: "NOW_SHOWING",
  ENDED: "ENDED",
  ARCHIVED: "ARCHIVED"
});

// Keep these two lists in sync with frontend/src/constants/movieOptions.js
export const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "Horror", "Musical", "Mystery",
  "Romance", "Sci-Fi", "Thriller", "War", "General"
];

export const RATINGS = ["G", "PG", "PG-13", "R", "18+"];

/* ------------------------------ dates ------------------------------ */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Today's date as YYYY-MM-DD in the cinema's time zone. */
export function todayString(now = new Date(), timeZone = config.timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const toDay = (value) => (value ? String(value).slice(0, 10) : null);

/* ----------------------------- status ----------------------------- */
export function getMovieStatus(movie, today = todayString()) {
  if (movie.archived === true) return MOVIE_STATUS.ARCHIVED;

  const start = toDay(movie.releaseDate);
  const end = toDay(movie.endDate);

  if (end && today > end) return MOVIE_STATUS.ENDED;
  if (start && today < start) return MOVIE_STATUS.COMING_SOON;
  return MOVIE_STATUS.NOW_SHOWING;
}

/** Adds the calculated `status` and a `bookable` flag to a movie document. */
export function decorateMovie(movie, today = todayString()) {
  if (!movie) return movie;
  const status = getMovieStatus(movie, today);
  return { ...movie, endDate: movie.endDate || null, status, bookable: status === MOVIE_STATUS.NOW_SHOWING };
}

export function bookingBlockedMessage(movie, status) {
  switch (status) {
    case MOVIE_STATUS.COMING_SOON:
      return `"${movie.title}" is coming soon and can't be booked yet. Booking opens on ${toDay(movie.releaseDate)}.`;
    case MOVIE_STATUS.ENDED:
      return `"${movie.title}" is no longer showing and can't be booked.`;
    case MOVIE_STATUS.ARCHIVED:
      return `"${movie.title}" has been archived and can't be booked.`;
    default:
      return "This movie can't be booked right now.";
  }
}

/* ---------------------- duplicate detection ---------------------- */
/** "Spider-Man: No Way Home " and "spider man no way home" give the same key. */
export function normalizeTitle(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function releaseYear(movie) {
  return toDay(movie.releaseDate)?.slice(0, 4) || "";
}

/* --------------------------- validation --------------------------- */
/**
 * Returns an error message, or null when the movie is valid.
 * `existing` (optional) is the stored movie being edited: an unchanged genre or
 * rating that pre-dates the dropdowns is tolerated so old records stay editable.
 */
export function validateMovie(movie, existing = null) {
  if (!movie.title || !String(movie.title).trim()) return "Title is required";
  if (String(movie.title).length > 150) return "Title must be 150 characters or fewer.";

  if (!(existing && movie.genre === existing.genre) && !GENRES.includes(movie.genre)) {
    return "Please choose a genre from the list.";
  }
  if (!(existing && movie.rating === existing.rating) && !RATINGS.includes(movie.rating)) {
    return "Please choose a rating from the list.";
  }

  if (!Number.isFinite(movie.duration) || movie.duration < 1 || movie.duration > 600) {
    return "Duration must be between 1 and 600 minutes.";
  }

  if (!isValidDateString(movie.releaseDate)) {
    return "Please provide a valid start (release) date.";
  }
  if (movie.endDate && !isValidDateString(movie.endDate)) {
    return "Please provide a valid end date.";
  }
  if (movie.endDate && movie.endDate < movie.releaseDate) {
    return "End date cannot be earlier than the start date.";
  }

  return null;
}

/** Clean the editable fields from a request body. Unknown keys are dropped. */
export function pickMovieFields(body = {}) {
  const out = {};
  for (const key of ["title", "description", "genre", "rating", "poster"]) {
    if (body[key] !== undefined) out[key] = String(body[key]).trim();
  }
  if (body.duration !== undefined) out.duration = Number(body.duration);
  if (body.releaseDate !== undefined && body.releaseDate !== "") out.releaseDate = String(body.releaseDate).slice(0, 10);
  if (body.endDate !== undefined) out.endDate = body.endDate ? String(body.endDate).slice(0, 10) : null;
  return out;
}

/* --------------------- showtimes vs availability --------------------- */
/** Returns an error message when a showtime date falls outside the movie's availability. */
export function showtimeDateProblem(movie, date, today = todayString()) {
  const status = getMovieStatus(movie, today);
  if (status === MOVIE_STATUS.ARCHIVED || status === MOVIE_STATUS.ENDED) {
    return `"${movie.title}" is ${status === MOVIE_STATUS.ARCHIVED ? "archived" : "no longer showing"}, so new showtimes can't be scheduled for it.`;
  }
  const day = toDay(date);
  const start = toDay(movie.releaseDate);
  const end = toDay(movie.endDate);
  if (start && day < start) return `Showtime date can't be before the movie's start date (${start}).`;
  if (end && day > end) return `Showtime date can't be after the movie's end date (${end}).`;
  return null;
}

/* ------------------------- auto archiving ------------------------- */
/**
 * Archives movies whose end date passed more than `afterDays` days ago.
 * Movies an admin restored by hand (`restoredAt`) are left alone.
 * Returns the number of movies archived.
 */
export async function archiveExpiredMovies(
  db,
  { today = todayString(), afterDays = config.movieAutoArchiveDays } = {}
) {
  if (!Number.isFinite(afterDays) || afterDays < 0) return 0;

  const cutoff = addDays(today, -afterDays);
  const result = await db.collection("movies").updateMany(
    {
      archived: { $ne: true },
      restoredAt: { $exists: false },
      endDate: { $type: "string", $lt: cutoff }
    },
    { $set: { archived: true, archivedAt: new Date(), autoArchived: true } }
  );
  return result.modifiedCount;
}
