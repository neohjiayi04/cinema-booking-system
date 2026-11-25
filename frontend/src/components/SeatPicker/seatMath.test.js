import { describe, it, expect } from "vitest";
import { normalizeSeats, viewStats, togetherNote } from "./seatMath";

const raw = [];
["A", "B"].forEach((row) => {
  for (let n = 1; n <= 4; n++) raw.push({ _id: `${row}${n}`, row, number: n, price: 18, status: row === "B" && n === 2 ? "booked" : "available" });
});

describe("normalizeSeats", () => {
  const seats = normalizeSeats(raw);

  it("adds labels, row order and status", () => {
    expect(seats).toHaveLength(8);
    expect(seats[0].label).toBe("A1");
    expect(seats.find((s) => s.id === "B2").status).toBe("TAKEN");
    expect(seats.find((s) => s.id === "A2").status).toBe("AVAILABLE");
  });

  it("puts later rows further from the screen and centres each row", () => {
    const a1 = seats.find((s) => s.id === "A1");
    const b1 = seats.find((s) => s.id === "B1");
    expect(b1.y).toBeGreaterThan(a1.y);
    const rowA = seats.filter((s) => s.row === "A");
    expect(Math.abs(rowA.reduce((sum, s) => sum + s.x, 0))).toBeLessThan(0.001);
  });

  it("returns an empty list for missing data", () => {
    expect(normalizeSeats(undefined)).toEqual([]);
    expect(normalizeSeats([])).toEqual([]);
  });

  it("accepts a custom adapter", () => {
    const out = normalizeSeats([{ r: "C", n: 3, free: false }], (s) => ({ id: "x", row: s.r, number: s.n, taken: !s.free, price: 10, type: "STANDARD" }));
    expect(out[0].label).toBe("C3");
    expect(out[0].status).toBe("TAKEN");
  });
});

describe("viewStats", () => {
  it("gives a wider field of view up close than at the back", () => {
    const near = viewStats({ x: 0, y: 6.3 });
    const far = viewStats({ x: 0, y: 13 });
    expect(near.angle).toBeGreaterThan(far.angle);
    expect(near.angle).toBeGreaterThan(80);
    expect(near.distance).toBe("6.3");
  });
});

describe("togetherNote", () => {
  const seat = (row, number) => ({ row, number, aisleAfter: 6 });
  it("handles every case", () => {
    expect(togetherNote([seat("F", 3)])).toBe("");
    expect(togetherNote([seat("F", 3), seat("F", 4)])).toBe("Seated together");
    expect(togetherNote([seat("F", 3), seat("F", 5)])).toBe("Seats are split up");
    expect(togetherNote([seat("F", 3), seat("G", 3)])).toBe("Seats are in different rows");
    expect(togetherNote([seat("F", 6), seat("F", 7)])).toBe("Side by side, but split by the aisle");
  });
});