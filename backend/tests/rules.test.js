import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HALL_STATUS,
  validateHall,
  isValidDate,
  isValidTime,
  findShowtimeConflict,
  showtimeWindow
} from "../src/utils/showtimeUtils.js";

const hall = { name: "Hall 1", rows: 5, seatsPerRow: 8, status: HALL_STATUS.ACTIVE };

test("hall layout requires at least one row and one seat", () => {
  assert.equal(validateHall({ ...hall, rows: 0 }), "Rows must be a whole number from 1 to 26.");
  assert.equal(validateHall({ ...hall, seatsPerRow: 0 }), "Seats per row must be a whole number from 1 to 50.");
  assert.equal(validateHall({ ...hall, rows: 2, seatsPerRow: 3 }), null);
});

test("showtime date and time validation rejects impossible values", () => {
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-12-01"), true);
  assert.equal(isValidTime("25:00"), false);
  assert.equal(isValidTime("19:30"), true);
});

test("showtime conflict includes the 20-minute cleaning window", () => {
  const candidate = { date: "2026-12-01", startTime: "20:19", duration: 100 };
  const other = [{ date: "2026-12-01", startTime: "18:00", duration: 120, title: "Movie A" }];
  assert.ok(findShowtimeConflict(candidate, other, 20));

  const allowed = { date: "2026-12-01", startTime: "20:20", duration: 100 };
  assert.equal(findShowtimeConflict(allowed, other, 20), null);
});

test("showtime windows end at movie duration before cleaning", () => {
  const window = showtimeWindow({ date: "2026-12-01", startTime: "18:00", duration: 120 }, 20);
  assert.equal(window.end - window.start, 120);
  assert.equal(window.free - window.end, 20);
});
