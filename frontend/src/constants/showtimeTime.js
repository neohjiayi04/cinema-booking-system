// Showtime date/time helpers. Showtimes are stored as a date ("2026-11-18") and a start time ("19:30")
// in the cinema's own time zone, so "has it started?" is checked against that zone, not the visitor's.
// Malaysia has no daylight saving, so a fixed UTC offset is enough. Override with VITE_CINEMA_UTC_OFFSET.
export const CINEMA_UTC_OFFSET = import.meta.env?.VITE_CINEMA_UTC_OFFSET || "+08:00";

function offsetMinutes(offset) {
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** The moment a showtime starts, as a Date, or null when its date/time can't be read. */
export function startsAt(showtime, offset = CINEMA_UTC_OFFSET) {
  const time = /^(\d{1,2}):(\d{2})/.exec(String(showtime?.startTime || "").trim());
  if (!showtime?.date || !time) return null;
  const date = new Date(`${showtime.date}T${time[1].padStart(2, "0")}:${time[2]}:00${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** True once the showtime's start time has passed. Unreadable times count as not started. */
export function hasStarted(showtime, now = Date.now(), offset = CINEMA_UTC_OFFSET) {
  const start = startsAt(showtime, offset);
  return start ? start.getTime() <= now : false;
}

/** Only the showtimes that have not started yet. */
export function upcomingShowtimes(showtimes, now = Date.now(), offset = CINEMA_UTC_OFFSET) {
  return (showtimes || []).filter((showtime) => !hasStarted(showtime, now, offset));
}

/** [[date, showtimes[]], ...] in date then time order. */
export function groupByDate(showtimes) {
  const sorted = [...(showtimes || [])].sort((a, b) =>
    `${a.date} ${String(a.startTime).padStart(5, "0")}`.localeCompare(`${b.date} ${String(b.startTime).padStart(5, "0")}`)
  );
  const groups = new Map();
  for (const showtime of sorted) {
    if (!groups.has(showtime.date)) groups.set(showtime.date, []);
    groups.get(showtime.date).push(showtime);
  }
  return [...groups.entries()];
}

/** Today's date ("YYYY-MM-DD") in the cinema's time zone. */
export function cinemaToday(now = Date.now(), offset = CINEMA_UTC_OFFSET) {
  return new Date(now + offsetMinutes(offset) * 60000).toISOString().slice(0, 10);
}

/** "Today", "Tomorrow", or e.g. "Wed 18 Nov". */
export function dateTabLabel(date, now = Date.now(), offset = CINEMA_UTC_OFFSET) {
  if (date === cinemaToday(now, offset)) return "Today";
  if (date === cinemaToday(now + 86400000, offset)) return "Tomorrow";
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
}
