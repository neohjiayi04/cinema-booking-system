import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOVIE_STATUS,
  addDays,
  decorateMovie,
  getMovieStatus,
  isValidDateString,
  normalizeTitle,
  pickMovieFields,
  showtimeDateProblem,
  todayString,
  validateMovie
} from "../src/utils/movieUtils.js";

const base = {
  title: "Test Movie",
  genre: "Action",
  rating: "PG",
  duration: 120,
  releaseDate: "2026-11-10",
  endDate: "2026-11-20"
};

test("status: before the start date is Coming Soon", () => {
  assert.equal(getMovieStatus(base, "2026-11-09"), MOVIE_STATUS.COMING_SOON);
});

test("status: start and end dates themselves are Now Showing (inclusive)", () => {
  assert.equal(getMovieStatus(base, "2026-11-10"), MOVIE_STATUS.NOW_SHOWING);
  assert.equal(getMovieStatus(base, "2026-11-15"), MOVIE_STATUS.NOW_SHOWING);
  assert.equal(getMovieStatus(base, "2026-11-20"), MOVIE_STATUS.NOW_SHOWING);
});

test("status: after the end date is Ended", () => {
  assert.equal(getMovieStatus(base, "2026-11-21"), MOVIE_STATUS.ENDED);
});

test("status: a movie without an end date stays Now Showing", () => {
  assert.equal(getMovieStatus({ ...base, endDate: null }, "2030-01-01"), MOVIE_STATUS.NOW_SHOWING);
});

test("status: archived overrides the dates", () => {
  assert.equal(getMovieStatus({ ...base, archived: true }, "2026-11-15"), MOVIE_STATUS.ARCHIVED);
});

test("decorateMovie marks only Now Showing movies as bookable", () => {
  assert.equal(decorateMovie(base, "2026-11-15").bookable, true);
  assert.equal(decorateMovie(base, "2026-11-09").bookable, false);
  assert.equal(decorateMovie(base, "2026-11-21").bookable, false);
  assert.equal(decorateMovie({ ...base, archived: true }, "2026-11-15").bookable, false);
});

test("validation: end date earlier than start date is rejected", () => {
  assert.match(validateMovie({ ...base, endDate: "2026-11-09" }), /End date cannot be earlier/);
});

test("validation: same-day run and a valid movie are accepted", () => {
  assert.equal(validateMovie({ ...base, endDate: "2026-11-10" }), null);
  assert.equal(validateMovie(base), null);
});

test("validation: genre and rating must come from the lists", () => {
  assert.match(validateMovie({ ...base, genre: "Whatever" }), /genre/);
  assert.match(validateMovie({ ...base, rating: "X" }), /rating/);
});

test("validation: an unchanged legacy genre is tolerated when editing", () => {
  const existing = { ...base, genre: "Action, Drama" };
  assert.equal(validateMovie({ ...existing, title: "Renamed" }, existing), null);
  assert.match(validateMovie({ ...existing, genre: "Nope" }, existing), /genre/);
});

test("validation: impossible calendar dates are rejected", () => {
  assert.equal(isValidDateString("2026-02-30"), false);
  assert.match(validateMovie({ ...base, releaseDate: "2026-02-30", endDate: null }), /start/);
});

test("duplicate key ignores case, spacing, punctuation and accents", () => {
  assert.equal(normalizeTitle(" Spider-Man:  No Way Home "), normalizeTitle("spider man no way home"));
  assert.equal(normalizeTitle("Amélie"), normalizeTitle("Amelie"));
  assert.notEqual(normalizeTitle("Dune"), normalizeTitle("Dune Part Two"));
});

test("pickMovieFields trims, converts and drops unknown fields", () => {
  const picked = pickMovieFields({ title: "  Hi ", duration: "95", endDate: "", status: "ARCHIVED", releaseDate: "2026-11-10T00:00:00Z" });
  assert.deepEqual(picked, { title: "Hi", duration: 95, endDate: null, releaseDate: "2026-11-10" });
});

test("showtimes cannot be scheduled outside the availability period", () => {
  assert.match(showtimeDateProblem(base, "2026-11-09", "2026-11-12"), /before/);
  assert.match(showtimeDateProblem(base, "2026-11-21", "2026-11-12"), /after/);
  assert.equal(showtimeDateProblem(base, "2026-11-15", "2026-11-12"), null);
  assert.match(showtimeDateProblem(base, "2026-11-15", "2026-11-30"), /no longer showing/);
  assert.match(showtimeDateProblem({ ...base, archived: true }, "2026-11-15", "2026-11-12"), /archived/);
});

test("date helpers", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.match(todayString(), /^\d{4}-\d{2}-\d{2}$/);
});
