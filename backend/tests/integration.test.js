
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { ObjectId } from "mongodb";

// Configure test environment before importing backend files.
process.env.DB_NAME = "cinema_booking_test";
process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017";
process.env.JWT_SECRET = "integration-test-secret";

const { connectDb, closeDb, getDb } =
  await import("../src/db.js");

const { app } = await import("../src/app.js");

// Test data IDs
const movieId = new ObjectId();
const hallId = new ObjectId();
const showtimeId = new ObjectId();

let customerToken;

before(async () => {
  await connectDb();

  const db = getDb();

  // Clear previous test records.
  await Promise.all([
    db.collection("users").deleteMany({}),
    db.collection("movies").deleteMany({}),
    db.collection("halls").deleteMany({}),
    db.collection("showtimes").deleteMany({}),
    db.collection("bookings").deleteMany({})
  ]);

  // Insert sample movie.
  await db.collection("movies").insertOne({
    _id: movieId,
    title: "Integration Test Movie",
    description: "Movie used for integration testing",
    genre: "Action",
    duration: 120,
    rating: "PG",
    poster: "",
    releaseDate: "2026-11-12",
    status: "NOW_SHOWING"
  });

  // Insert sample cinema hall.
  await db.collection("halls").insertOne({
    _id: hallId,
    name: "Test Hall",
    rows: 2,
    seatsPerRow: 5
  });

  // Insert sample showtime.
  await db.collection("showtimes").insertOne({
    _id: showtimeId,
    movieId,
    hallId,
    date: "2026-11-20",
    startTime: "19:00",
    price: 18,
    status: "ACTIVE"
  });
});

after(async () => {
  await closeDb();
});

// Test 1: Health Check API
test("GET /api/health should return backend status", async () => {
  const response = await request(app)
    .get("/api/health")
    .expect(200);

  assert.equal(response.body.ok, true);
  assert.equal(
    response.body.service,
    "cinema-booking-backend"
  );
});

// Test 2: Database Connection
test("MongoDB should connect to the test database", () => {
  const db = getDb();

  assert.equal(db.databaseName, "cinema_booking_test");
});

// Test 3: Retrieve Movies
test("GET /api/movies should return movies from MongoDB", async () => {
  const response = await request(app)
    .get("/api/movies")
    .expect(200);

  assert.ok(Array.isArray(response.body));

  const movie = response.body.find(
    item => item._id === movieId.toString()
  );

  assert.ok(movie);
  assert.equal(movie.title, "Integration Test Movie");
});

// Test 4: Retrieve Showtimes
test("GET /api/showtimes should return showtimes with movie and hall details", async () => {
  const response = await request(app)
    .get("/api/showtimes")
    .expect(200);

  assert.ok(Array.isArray(response.body));

  const showtime = response.body.find(
    item => item._id === showtimeId.toString()
  );

  assert.ok(showtime);
  assert.equal(showtime.movie.title, "Integration Test Movie");
  assert.equal(showtime.hall.name, "Test Hall");
});

// Test 5: Customer Registration
test("POST /api/auth/register should register a customer", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Integration Tester",
      email: "integration@test.com",
      password: "Test123456"
    })
    .expect(201);

  assert.equal(response.body.user.name, "Integration Tester");
  assert.equal(response.body.user.role, "customer");

  assert.ok(response.body.token);

  customerToken = response.body.token;
});

// Test 6: Create Booking
test("POST /api/bookings should create a booking for an authenticated customer", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["A01", "A02"]
    })
    .expect(201);

  assert.equal(response.body.status, "CONFIRMED");
  assert.equal(response.body.totalAmount, 36);
  assert.deepEqual(response.body.seats, ["A01", "A02"]);

  assert.ok(response.body.bookingReference);
  assert.ok(response.body._id);
});

// Test 7: Reject Invalid Seats
test("POST /api/bookings should reject invalid seats", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["Z99"]
    })
    .expect(400);

  assert.match(response.body.message, /invalid/i);
});

// Test 8: Reject Unauthenticated Booking
test("POST /api/bookings should reject requests without authentication", async () => {
  await request(app)
    .post("/api/bookings")
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["B01"]
    })
    .expect(401);
});
