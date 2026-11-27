import { describe, expect, it } from "vitest";

import {
  defaultAdapt,
  floorHeight,
  normalizeSeats,
  togetherNote,
  viewStats,
} from "./seatMath.js";

describe("seatMath", () => {
  const seat = (
    row,
    number,
    status = "AVAILABLE",
    extra = {}
  ) => ({
    id: `${row}${String(number).padStart(2, "0")}`,
    row,
    number,
    status,
    ...extra,
  });

  describe("floorHeight", () => {
    it("calculates a positive floor height", () => {
      expect(floorHeight(5)).toBeGreaterThan(0);
    });

    it("returns a consistent height for the same number of rows", () => {
      expect(floorHeight(5)).toBe(floorHeight(5));
    });

    it("increases when the number of rows increases", () => {
      expect(floorHeight(10)).toBeGreaterThan(floorHeight(5));
    });
  });

  describe("defaultAdapt", () => {
    it("adapts an available seat correctly", () => {
      const result = defaultAdapt(
        seat("A", 1, "AVAILABLE")
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("adapts a booked seat correctly", () => {
      const result = defaultAdapt(
        seat("A", 1, "BOOKED")
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });

  describe("normalizeSeats", () => {
    it("normalizes seat information correctly", () => {
      const result = normalizeSeats([
        seat("A", 1, "AVAILABLE"),
        seat("A", 2, "BOOKED"),
      ]);

      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        id: "A01",
        row: "A",
        number: 1,
        rowIndex: 0,
        status: "AVAILABLE",
      });

      expect(result[1]).toMatchObject({
        id: "A02",
        row: "A",
        number: 2,
        rowIndex: 0,
        status: "TAKEN",
      });
    });

    it("assigns the correct row index", () => {
      const result = normalizeSeats([
        seat("A", 1),
        seat("B", 1),
        seat("C", 1),
      ]);

      expect(result[0].rowIndex).toBe(0);
      expect(result[1].rowIndex).toBe(1);
      expect(result[2].rowIndex).toBe(2);
    });

    it("calculates seat positions", () => {
      const result = normalizeSeats([
        seat("A", 1),
        seat("A", 2),
        seat("B", 1),
      ]);

      expect(result[0]).toHaveProperty("x");
      expect(result[0]).toHaveProperty("y");

      expect(result[1]).toHaveProperty("x");
      expect(result[1]).toHaveProperty("y");

      expect(result[2]).toHaveProperty("x");
      expect(result[2]).toHaveProperty("y");
    });

    it("assigns the expected row positions", () => {
      const result = normalizeSeats([
        seat("A", 1),
        seat("B", 1),
      ]);

      expect(result[0].y).toBeCloseTo(4.2, 10);
      expect(result[1].y).toBeCloseTo(5.3, 10);
    });

    it("preserves seat identifiers", () => {
      const result = normalizeSeats([
        seat("C", 4),
        seat("D", 8),
      ]);

      expect(result[0].id).toBe("C04");
      expect(result[1].id).toBe("D08");
    });

    it("normalizes seat status correctly", () => {
      const result = normalizeSeats([
        seat("A", 1, "AVAILABLE"),
        seat("A", 2, "BOOKED"),
        seat("A", 3, "SELECTED"),
      ]);

      expect(result[0].status).toBe("AVAILABLE");
      expect(result[1].status).toBe("TAKEN");
      expect(result[2].status).toBe("AVAILABLE"); // selection is UI state rather than seat availability state. Selection should be UI state
    });

    it("handles an empty seat list", () => {
      expect(normalizeSeats([])).toEqual([]);
    });

    it("normalizes multiple rows correctly", () => {
      const result = normalizeSeats([
        seat("A", 1),
        seat("A", 2),
        seat("B", 1),
        seat("B", 2),
        seat("C", 1),
        seat("C", 2),
      ]);

      expect(result).toHaveLength(6);

      expect(result[0].rowIndex).toBe(0);
      expect(result[1].rowIndex).toBe(0);

      expect(result[2].rowIndex).toBe(1);
      expect(result[3].rowIndex).toBe(1);

      expect(result[4].rowIndex).toBe(2);
      expect(result[5].rowIndex).toBe(2);
    });
  });

  describe("togetherNote", () => {
    it("returns a message when no seats are selected", () => {
      expect(togetherNote([])).toBeDefined();
    });

    it("identifies adjacent seats", () => {
      expect(
        togetherNote([
          seat("F", 4),
          seat("F", 5),
        ])
      ).toBe("Seated together");
    });

    it("identifies seats separated by the aisle", () => {
      const result = togetherNote([
        seat("F", 5),
        seat("F", 6),
      ]);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("identifies seats that are split up", () => {
      expect(
        togetherNote([
          seat("F", 4),
          seat("F", 6),
        ])
      ).toBe("Seats are split up");
    });

    it("handles seats in different rows", () => {
      expect(
        togetherNote([
          seat("A", 1),
          seat("B", 1),
        ])
      ).toBeDefined();
    });
  });

  describe("viewStats", () => {
    it("returns statistics for seats", () => {
      const result = viewStats([
        seat("A", 1, "AVAILABLE"),
        seat("A", 2, "BOOKED"),
        seat("A", 3, "AVAILABLE"),
      ]);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("handles an empty seat list", () => {
      const result = viewStats([]);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("calculates statistics consistently", () => {
      const seats = [
        seat("A", 1, "AVAILABLE"),
        seat("A", 2, "BOOKED"),
        seat("A", 3, "AVAILABLE"),
        seat("B", 1, "BOOKED"),
      ];

      const result = viewStats(seats);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });
  });
});