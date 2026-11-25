/* Showtime status: Upcoming -> Now showing -> Ended.
   Cinema timezone is Malaysia (UTC+8), same as My Bookings.
   Shared by the Showtimes and Halls pages. */

export const SHOWTIME_STATUS = {
  UPCOMING: { label: "Upcoming", className: "admin-status-info" },
  NOW_SHOWING: { label: "Now showing", className: "admin-status-success" },
  ENDED: { label: "Ended", className: "admin-status-warning" },
  UNKNOWN: { label: "—", className: "" },
};

export function getShowtimeStatus(showtime, durationMinutes, now = Date.now()) {
  const date = String(showtime.date || "").slice(0, 10);

  if (!date || !/^\d{2}:\d{2}$/.test(showtime.startTime || "")) {
    return "UNKNOWN";
  }

  const start = new Date(`${date}T${showtime.startTime}:00+08:00`).getTime();

  if (!Number.isFinite(start)) {
    return "UNKNOWN";
  }

  // Fall back to 120 min if the movie duration is not available
  const duration =
    Number.isFinite(durationMinutes) && durationMinutes >= 0
      ? durationMinutes
      : 120;

  const end = start + duration * 60 * 1000;

  if (now >= end) return "ENDED";
  if (now >= start) return "NOW_SHOWING";
  return "UPCOMING";
}