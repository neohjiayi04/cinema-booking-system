// Keep GENRES and RATINGS in sync with backend/src/utils/movieUtils.js
export const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "Horror", "Musical", "Mystery",
  "Romance", "Sci-Fi", "Thriller", "War", "General"
];

export const RATINGS = ["G", "PG", "PG-13", "R", "18+"];

export const MOVIE_STATUS = {
  COMING_SOON: "COMING_SOON",
  NOW_SHOWING: "NOW_SHOWING",
  ENDED: "ENDED",
  ARCHIVED: "ARCHIVED"
};

export const MOVIE_STATUS_LABELS = {
  COMING_SOON: "Coming Soon",
  NOW_SHOWING: "Now Showing",
  ENDED: "Ended",
  ARCHIVED: "Archived"
};

// Movies from older API responses may not have a status yet.
export const statusOf = (movie) => movie?.status || MOVIE_STATUS.NOW_SHOWING;

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// api() errors look like "409 Conflict: message". Show only the message.
export const cleanError = (error, fallback = "Something went wrong.") =>
  String(error?.message || fallback).replace(/^\d{3}[^:]*:\s*/, "");
