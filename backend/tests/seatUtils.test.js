import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateValidSeats,
  validateSeats,
  calculateBookingTotal
} from "../src/utils/seatUtils.js";


// =====================================================
// SEAT GENERATION TESTS
// =====================================================

// Test 1: Generate correct number of seats
test("generate the correct number of seats", () => {
  const seats = generateValidSeats(3, 5);

  assert.equal(seats.size, 15);
});


// Test 2: Generate correctly formatted seat labels
test("generate seats with correct labels", () => {
  const seats = generateValidSeats(2, 3);

  assert.ok(seats.has("A01"));
  assert.ok(seats.has("A03"));
  assert.ok(seats.has("B01"));
  assert.ok(seats.has("B03"));
});


// =====================================================
// SEAT VALIDATION TESTS
// =====================================================

// Test 3: Accept valid seats
test("accept valid selected seats", () => {
  assert.equal(
    validateSeats(["A01", "A02"], 3, 5),
    true
  );
});


// Test 4: Reject invalid seats
test("reject invalid selected seats", () => {
  assert.equal(
    validateSeats(["A01", "Z99"], 3, 5),
    false
  );
});


// Test 5: Reject empty seat selection
test("reject an empty seat selection", () => {
  assert.equal(
    validateSeats([], 3, 5),
    false
  );
});


// Test 6: Reject non-array input
test("reject invalid input", () => {
  assert.equal(
    validateSeats("A01", 3, 5),
    false
  );
});


// =====================================================
// BOOKING PRICE CALCULATION TESTS
// =====================================================

// Test 7: Calculate one-seat booking
test("calculate the total for one seat", () => {
  assert.equal(
    calculateBookingTotal(1, 15),
    15
  );
});


// Test 8: Calculate multiple-seat booking
test("calculate the total for multiple seats", () => {
  assert.equal(
    calculateBookingTotal(4, 15), // run real function and return actual result
    60 // expected result
  );
});


// Test 9: Handle decimal ticket prices
test("calculate totals with decimal prices", () => {
  assert.equal(
    calculateBookingTotal(3, 12.5),
    37.5
  );
});


// Test 10: Handle price provided as a string
test("calculate the total when price is provided as a string", () => {
  assert.equal(
    calculateBookingTotal(2, "20"),
    40
  );
});