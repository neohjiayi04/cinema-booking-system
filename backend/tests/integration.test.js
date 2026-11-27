import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { ObjectId } from "mongodb";
import WebSocket from "ws";

// Configure test environment before importing backend files.
process.env.DB_NAME = "cinema_booking_test";
process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017";
process.env.JWT_SECRET = "integration-test-secret";

const { connectDb, closeDb, getDb } =
  await import("../src/db.js");

const { app, server } =
  await import("../src/app.js");

const { hashPassword, createToken } =
  await import("../src/auth.js");

// Showtimes must be in the future to be bookable, so fixture dates are generated
// relative to today instead of being hard-coded (a fixed date eventually expires).
const futureDate = (daysAhead) =>
  new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// --------------------------------------------------
// TEST FIXTURES
// --------------------------------------------------

const movieId = new ObjectId();
const hallId = new ObjectId();
const showtimeId = new ObjectId();

let customerToken;
let secondCustomerToken;
let adminToken;
let adminId;
let bookingId;

// --------------------------------------------------
// WEBSOCKET HELPER
// --------------------------------------------------

function waitForWsMessage(socket, expectedType) {
  return new Promise((resolve, reject) => {
    const onMessage = raw => {
      const message = JSON.parse(raw.toString());

      if (message.type === expectedType) {
        cleanup();
        resolve(message);
      }
    };

    const onError = error => {
      cleanup();
      reject(error);
    };

    function cleanup() {
      socket.off("message", onMessage);
      socket.off("error", onError);
    }

    socket.on("message", onMessage);
    socket.on("error", onError);
  });
}

// --------------------------------------------------
// DATABASE SETUP
// --------------------------------------------------

before(async () => {
  await connectDb();

  const db = getDb();

  // Clear only the test database.
  await Promise.all([
    db.collection("users").deleteMany({}),
    db.collection("movies").deleteMany({}),
    db.collection("halls").deleteMany({}),
    db.collection("showtimes").deleteMany({}),
    db.collection("bookings").deleteMany({})
  ]);

  // Create administrator.
  const adminUser = {
    _id: new ObjectId(),
    name: "Admin Tester",
    email: "admin@test.com",
    passwordHash: await hashPassword("Admin123456"),
    role: "admin",
    createdAt: new Date()
  };

  await db.collection("users").insertOne(adminUser);

  adminId = adminUser._id.toString();
  adminToken = createToken(adminUser);

  // Create sample movie.
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

  // Create sample hall.
  await db.collection("halls").insertOne({
    _id: hallId,
    name: "Test Hall",
    rows: 2,
    seatsPerRow: 5
  });

  // Create sample showtime.
  await db.collection("showtimes").insertOne({
    _id: showtimeId,
    movieId,
    hallId,
    date: futureDate(30),
    startTime: "19:00",
    price: 18,
    status: "ACTIVE"
  });

  // Start HTTP and WebSocket server on an available port.
  await new Promise(resolve => server.listen(0, resolve));
});

after(async () => {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await closeDb();
});

// ==================================================
// 1. HEALTH CHECK AND DATABASE
// ==================================================

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

test("MongoDB should connect to the test database", () => {
  assert.equal(
    getDb().databaseName,
    "cinema_booking_test"
  );
});

// ==================================================
// 2. MOVIE RETRIEVAL
// ==================================================

test("GET /api/movies should return movies", async () => {
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

test("GET /api/movies/:id should return a movie", async () => {
  const response = await request(app)
    .get(`/api/movies/${movieId}`)
    .expect(200);

  assert.equal(response.body.title, "Integration Test Movie");
});

test("GET /api/movies/:id should return 404 for a missing movie", async () => {
  await request(app)
    .get(`/api/movies/${new ObjectId()}`)
    .expect(404);
});

// ==================================================
// 3. SHOWTIME RETRIEVAL
// ==================================================

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

test("GET /api/showtimes should filter by movie ID", async () => {
  const response = await request(app)
    .get(`/api/showtimes?movieId=${movieId}`)
    .expect(200);

  assert.ok(response.body.length > 0);

  assert.ok(
    response.body.every(
      item => item.movieId === movieId.toString()
    )
  );
});

test("GET /api/showtimes/:id should return showtime and booked seats", async () => {
  const response = await request(app)
    .get(`/api/showtimes/${showtimeId}`)
    .expect(200);

  assert.equal(response.body.movie.title, "Integration Test Movie");
  assert.equal(response.body.hall.name, "Test Hall");
  assert.ok(Array.isArray(response.body.bookedSeats));
});

test("GET /api/showtimes/:id should return 404 for a missing showtime", async () => {
  await request(app)
    .get(`/api/showtimes/${new ObjectId()}`)
    .expect(404);
});

// ==================================================
// 4. AUTHENTICATION
// ==================================================

test("POST /api/auth/register should reject missing fields", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Incomplete User",
      email: "incomplete@test.com"
    })
    .expect(400);
});

test("POST /api/auth/register should reject short passwords", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Short Password User",
      email: "short@test.com",
      password: "123"
    })
    .expect(400);
});

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
  assert.ok(response.body.user.id);
  assert.ok(response.body.token);

  assert.equal(
    Object.hasOwn(response.body.user, "passwordHash"),
    false
  );

  customerToken = response.body.token;
});

test("POST /api/auth/register should normalize email addresses", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Email Normalization User",
      email: "  NORMALIZED@test.com  ",
      password: "Test123456"
    })
    .expect(201);

  assert.equal(
    response.body.user.email,
    "normalized@test.com"
  );
});

test("POST /api/auth/register should reject duplicate email addresses", async () => {
  await request(app)
    .post("/api/auth/register")
    .send({
      name: "Duplicate User",
      email: "integration@test.com",
      password: "Test123456"
    })
    .expect(409);
});

test("POST /api/auth/login should authenticate a customer", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: "integration@test.com",
      password: "Test123456"
    })
    .expect(200);

  assert.equal(response.body.user.role, "customer");
  assert.ok(response.body.token);
});

test("POST /api/auth/login should normalize email addresses", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: "  INTEGRATION@TEST.COM ",
      password: "Test123456"
    })
    .expect(200);

  assert.equal(response.body.user.email, "integration@test.com");
});

test("POST /api/auth/login should reject incorrect passwords", async () => {
  await request(app)
    .post("/api/auth/login")
    .send({
      email: "integration@test.com",
      password: "WrongPassword"
    })
    .expect(401);
});

test("POST /api/auth/login should reject unknown email addresses", async () => {
  await request(app)
    .post("/api/auth/login")
    .send({
      email: "unknown@test.com",
      password: "Test123456"
    })
    .expect(401);
});

test("POST /api/auth/login should authenticate an administrator", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      email: "admin@test.com",
      password: "Admin123456"
    })
    .expect(200);

  assert.equal(response.body.user.role, "admin");
});

// ==================================================
// 5. CUSTOMER PROFILE
// ==================================================

test("PUT /api/auth/me should reject unauthenticated requests", async () => {
  await request(app)
    .put("/api/auth/me")
    .send({
      name: "Updated Name",
      email: "updated@test.com"
    })
    .expect(401);
});

test("PUT /api/auth/me should reject invalid names", async () => {
  await request(app)
    .put("/api/auth/me")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      name: " ",
      email: "valid@test.com"
    })
    .expect(400);
});

test("PUT /api/auth/me should reject invalid email addresses", async () => {
  await request(app)
    .put("/api/auth/me")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      name: "Updated Name",
      email: "invalid-email"
    })
    .expect(400);
});

test("PUT /api/auth/me should reject duplicate email addresses", async () => {
  await request(app)
    .put("/api/auth/me")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      name: "Updated Name",
      email: "admin@test.com"
    })
    .expect(409);
});

test("PUT /api/auth/me should update customer profile", async () => {
  const response = await request(app)
    .put("/api/auth/me")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      name: "Updated Integration Tester",
      email: "updated-integration@test.com"
    })
    .expect(200);

  assert.equal(
    response.body.user.name,
    "Updated Integration Tester"
  );

  assert.equal(
    response.body.user.email,
    "updated-integration@test.com"
  );
});

// ==================================================
// 6. USER MANAGEMENT
// ==================================================

test("GET /api/users should allow admin and hide password hashes", async () => {
  const response = await request(app)
    .get("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  assert.ok(Array.isArray(response.body));

  assert.ok(
    response.body.some(user => user.id === adminId)
  );

  for (const user of response.body) {
    assert.equal(
      Object.hasOwn(user, "passwordHash"),
      false
    );
  }
});

test("GET /api/users should reject customer access", async () => {
  await request(app)
    .get("/api/users")
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("GET /api/users should reject unauthenticated requests", async () => {
  await request(app)
    .get("/api/users")
    .expect(401);
});

// ==================================================
// 7. MOVIE ADMINISTRATION
// ==================================================

test("POST /api/movies should reject unauthenticated requests", async () => {
  await request(app)
    .post("/api/movies")
    .send({ title: "Unauthorized Movie" })
    .expect(401);
});

test("POST /api/movies should reject customer access", async () => {
  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ title: "Unauthorized Movie" })
    .expect(403);
});

test("POST /api/movies should reject missing movie title", async () => {
  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ description: "Missing title" })
    .expect(400);
});

test("POST /api/movies should allow admin to create a movie", async () => {
  const response = await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Admin Created Movie",
      description: "Created during integration testing",
      genre: "Comedy",
      duration: 100,
      rating: "PG",
      releaseDate: "2026-12-01"
    })
    .expect(201);

  assert.equal(response.body.title, "Admin Created Movie");
  assert.ok(response.body._id);
});

test("PUT /api/movies/:id should allow admin to update a movie", async () => {
  const response = await request(app)
    .put(`/api/movies/${movieId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Updated Integration Movie",
      duration: 135
    })
    .expect(200);

  assert.equal(response.body.title, "Updated Integration Movie");
  assert.equal(response.body.duration, 135);
});

test("PUT /api/movies/:id should reject customer access", async () => {
  await request(app)
    .put(`/api/movies/${movieId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ title: "Unauthorized Update" })
    .expect(403);
});

test("PUT /api/movies/:id should return 404 for a missing movie", async () => {
  await request(app)
    .put(`/api/movies/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title: "Missing Movie" })
    .expect(404);
});

test("DELETE /api/movies/:id should reject customer access", async () => {
  await request(app)
    .delete(`/api/movies/${movieId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("DELETE /api/movies/:id should allow admin to delete a movie", async () => {
  const movie = await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title: "Movie To Delete" })
    .expect(201);

  await request(app)
    .delete(`/api/movies/${movie.body._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
});

test("DELETE /api/movies/:id should return 404 for a missing movie", async () => {
  await request(app)
    .delete(`/api/movies/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(404);
});

// ==================================================
// 8. HALL ADMINISTRATION
// ==================================================

test("GET /api/halls should return cinema halls", async () => {
  const response = await request(app)
    .get("/api/halls")
    .expect(200);

  assert.ok(Array.isArray(response.body));

  assert.ok(
    response.body.some(
      hall => hall._id === hallId.toString()
    )
  );
});

test("POST /api/halls should reject customer access", async () => {
  await request(app)
    .post("/api/halls")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      name: "Unauthorized Hall",
      rows: 5,
      seatsPerRow: 10
    })
    .expect(403);
});

test("POST /api/halls should reject missing hall information", async () => {
  await request(app)
    .post("/api/halls")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Incomplete Hall" })
    .expect(400);
});

test("POST /api/halls should allow admin to create a hall", async () => {
  const response = await request(app)
    .post("/api/halls")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "New Test Hall",
      rows: 3,
      seatsPerRow: 8
    })
    .expect(201);

  assert.equal(response.body.name, "New Test Hall");
  assert.equal(response.body.rows, 3);
  assert.equal(response.body.seatsPerRow, 8);
});

test("PUT /api/halls/:id should allow admin to update a hall", async () => {
  const response = await request(app)
    .put(`/api/halls/${hallId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Updated Test Hall",
      rows: "2",
      seatsPerRow: "5"
    })
    .expect(200);

  assert.equal(response.body.name, "Updated Test Hall");
  assert.equal(response.body.rows, 2);
  assert.equal(response.body.seatsPerRow, 5);
});

test("PUT /api/halls/:id should reject customer access", async () => {
  await request(app)
    .put(`/api/halls/${hallId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ name: "Unauthorized Hall Update" })
    .expect(403);
});

test("PUT /api/halls/:id should return 404 for a missing hall", async () => {
  await request(app)
    .put(`/api/halls/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Missing Hall" })
    .expect(404);
});

test("DELETE /api/halls/:id should reject customer access", async () => {
  await request(app)
    .delete(`/api/halls/${hallId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("DELETE /api/halls/:id should allow admin to delete a hall", async () => {
  const hall = await request(app)
    .post("/api/halls")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Hall To Delete",
      rows: 2,
      seatsPerRow: 5
    })
    .expect(201);

  await request(app)
    .delete(`/api/halls/${hall.body._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
});

test("DELETE /api/halls/:id should return 404 for a missing hall", async () => {
  await request(app)
    .delete(`/api/halls/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(404);
});

// ==================================================
// 9. SHOWTIME ADMINISTRATION
// ==================================================

test("POST /api/showtimes should reject customer access", async () => {
  await request(app)
    .post("/api/showtimes")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      movieId: movieId.toString(),
      hallId: hallId.toString(),
      date: futureDate(35),
      startTime: "20:00",
      price: 20
    })
    .expect(403);
});

test("POST /api/showtimes should reject missing required fields", async () => {
  await request(app)
    .post("/api/showtimes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      movieId: movieId.toString()
    })
    .expect(400);
});

test("POST /api/showtimes should allow admin to create a showtime", async () => {
  const response = await request(app)
    .post("/api/showtimes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      movieId: movieId.toString(),
      hallId: hallId.toString(),
      date: futureDate(36),
      startTime: "21:00",
      price: 22
    })
    .expect(201);

  assert.equal(response.body.price, 22);
  assert.equal(response.body.status, "ACTIVE");
});

test("PUT /api/showtimes/:id should allow admin to update a showtime", async () => {
  const response = await request(app)
    .put(`/api/showtimes/${showtimeId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      startTime: "20:00",
      price: "20"
    })
    .expect(200);

  assert.equal(response.body.startTime, "20:00");
  assert.equal(response.body.price, 20);
});

test("PUT /api/showtimes/:id should reject customer access", async () => {
  await request(app)
    .put(`/api/showtimes/${showtimeId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ startTime: "21:00" })
    .expect(403);
});

test("PUT /api/showtimes/:id should return 404 for a missing showtime", async () => {
  await request(app)
    .put(`/api/showtimes/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ startTime: "21:00" })
    .expect(404);
});

test("DELETE /api/showtimes/:id should reject customer access", async () => {
  await request(app)
    .delete(`/api/showtimes/${showtimeId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("DELETE /api/showtimes/:id should allow admin to delete a showtime", async () => {
  const showtime = await request(app)
    .post("/api/showtimes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      movieId: movieId.toString(),
      hallId: hallId.toString(),
      date: futureDate(37),
      startTime: "18:00",
      price: 18
    })
    .expect(201);

  await request(app)
    .delete(`/api/showtimes/${showtime.body._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);
});

test("DELETE /api/showtimes/:id should return 404 for a missing showtime", async () => {
  await request(app)
    .delete(`/api/showtimes/${new ObjectId()}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(404);
});

// ==================================================
// 10. WEBSOCKET
// ==================================================

test("WebSocket should connect and send CONNECTED message", async () => {
  const port = server.address().port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  try {
    const message = await waitForWsMessage(socket, "CONNECTED");

    assert.equal(message.type, "CONNECTED");
    assert.ok(message.message);
  } finally {
    socket.close();

    await new Promise(resolve => {
      socket.once("close", resolve);
    });
  }
});

test("WebSocket should join a showtime room", async () => {
  const port = server.address().port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  try {
    await waitForWsMessage(socket, "CONNECTED");

    socket.send(JSON.stringify({
      type: "JOIN_SHOWTIME",
      showtimeId: showtimeId.toString()
    }));

    const message = await waitForWsMessage(
      socket,
      "JOINED_SHOWTIME"
    );

    assert.equal(
      message.showtimeId,
      showtimeId.toString()
    );
  } finally {
    socket.close();

    await new Promise(resolve => {
      socket.once("close", resolve);
    });
  }
});

test("WebSocket should return an error for invalid JSON", async () => {
  const port = server.address().port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  try {
    await waitForWsMessage(socket, "CONNECTED");

    const errorPromise = waitForWsMessage(socket, "ERROR");

    socket.send("{invalid-json");

    const message = await errorPromise;

    assert.equal(message.message, "Invalid WebSocket message");
  } finally {
    socket.close();

    await new Promise(resolve => {
      socket.once("close", resolve);
    });
  }
});

test("WebSocket should receive SEAT_BOOKED when a customer books seats", async () => {
  const port = server.address().port;
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  try {
    await waitForWsMessage(socket, "CONNECTED");

    socket.send(JSON.stringify({
      type: "JOIN_SHOWTIME",
      showtimeId: showtimeId.toString()
    }));

    await waitForWsMessage(socket, "JOINED_SHOWTIME");

    const notificationPromise = waitForWsMessage(
      socket,
      "SEAT_BOOKED"
    );

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        showtimeId: showtimeId.toString(),
        seats: ["B05"]
      })
      .expect(201);

    assert.deepEqual(response.body.seats, ["B05"]);

    const notification = await notificationPromise;

    assert.equal(notification.type, "SEAT_BOOKED");
    assert.deepEqual(notification.seats, ["B05"]);
  } finally {
    socket.close();

    await new Promise(resolve => {
      socket.once("close", resolve);
    });
  }
});

// ==================================================
// 11. BOOKING CREATION
// ==================================================

test("POST /api/bookings should reject unauthenticated requests", async () => {
  await request(app)
    .post("/api/bookings")
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["A01"]
    })
    .expect(401);
});

test("POST /api/bookings should reject missing showtime or seats", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["A01"] })
    .expect(400);
});

test("POST /api/bookings should reject an empty seat selection", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: []
    })
    .expect(400);
});

test("POST /api/bookings should reject a missing showtime", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: new ObjectId().toString(),
      seats: ["A01"]
    })
    .expect(404);
});

test("POST /api/bookings should reject invalid seats", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["Z99"]
    })
    .expect(400);
});

test("POST /api/bookings should create a booking", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["A01", "A02"]
    })
    .expect(201);

  assert.equal(response.body.status, "CONFIRMED");
  assert.equal(response.body.totalAmount, 40);
  assert.deepEqual(response.body.seats, ["A01", "A02"]);
  assert.equal(response.body.username, "Updated Integration Tester");

  assert.ok(response.body.bookingReference);
  assert.ok(response.body._id);

  bookingId = response.body._id;
});

test("POST /api/bookings should remove duplicate seat selections", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["A05", "A05"]
    })
    .expect(201);

  assert.deepEqual(response.body.seats, ["A05"]);
  assert.equal(response.body.totalAmount, 20);
});

// ==================================================
// 12. BOOKING RETRIEVAL AND AUTHORIZATION
// ==================================================

test("GET /api/bookings/:id should return booking details", async () => {
  const response = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(200);

  assert.equal(response.body._id, bookingId);
  assert.deepEqual(response.body.seats, ["A01", "A02"]);
});

test("GET /api/bookings/:id should reject unauthenticated requests", async () => {
  await request(app)
    .get(`/api/bookings/${bookingId}`)
    .expect(401);
});

test("GET /api/bookings/:id should return 404 for a missing booking", async () => {
  await request(app)
    .get(`/api/bookings/${new ObjectId()}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(404);
});

test("GET /api/bookings/my should return the customer's bookings", async () => {
  const response = await request(app)
    .get("/api/bookings/my")
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(200);

  assert.ok(Array.isArray(response.body));

  assert.ok(
    response.body.some(item => item._id === bookingId)
  );
});

test("GET /api/bookings should allow admin to retrieve all bookings", async () => {
  const response = await request(app)
    .get("/api/bookings")
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  assert.ok(Array.isArray(response.body));

  assert.ok(
    response.body.some(item => item._id === bookingId)
  );
});

test("GET /api/bookings should reject customer access", async () => {
  await request(app)
    .get("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("GET /api/bookings/:id should allow admin to view any booking", async () => {
  const response = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  assert.equal(response.body._id, bookingId);
});

// ==================================================
// 13. BOOKING OWNERSHIP
// ==================================================

test("A second customer should be able to register", async () => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Second Customer",
      email: "second@test.com",
      password: "Second123456"
    })
    .expect(201);

  secondCustomerToken = response.body.token;

  assert.equal(response.body.user.role, "customer");
});

test("A customer should not view another customer's booking", async () => {
  await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .expect(403);
});

test("A customer should not update another customer's booking", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .send({ seats: ["B02"] })
    .expect(404);
});

test("A customer should not cancel another customer's booking", async () => {
  await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .expect(404);
});

// ==================================================
// 14. BOOKING SEAT UPDATES
// ==================================================

test("PUT /api/bookings/:id should reject unauthenticated requests", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .send({ seats: ["A03"] })
    .expect(401);
});

test("PUT /api/bookings/:id should reject empty seat selections", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: [] })
    .expect(400);
});

test("PUT /api/bookings/:id should reject duplicate seats", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["A03", "A03"] })
    .expect(400);
});

test("PUT /api/bookings/:id should reject invalid seats", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["Z99"] })
    .expect(400);
});

test("PUT /api/bookings/:id should update booking seats", async () => {
  const response = await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["A03", "A04"] })
    .expect(200);

  assert.deepEqual(response.body.seats, ["A03", "A04"]);
  assert.equal(response.body.totalAmount, 40);
});

test("PUT /api/bookings/:id should normalize seat labels", async () => {
  const response = await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: [" b02 "] })
    .expect(200);

  assert.deepEqual(response.body.seats, ["B02"]);
});

test("A second customer should create a separate booking", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["B01"]
    })
    .expect(201);
});

test("POST /api/bookings should reject seats already booked by another customer", async () => {
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["B01"]
    })
    .expect(409);
});

test("PUT /api/bookings/:id should reject seats occupied by another booking", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["B01"] })
    .expect(409);
});

test("PUT /api/bookings/:id should return 404 for a missing booking", async () => {
  await request(app)
    .put(`/api/bookings/${new ObjectId()}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["A01"] })
    .expect(404);
});

// ==================================================
// 15. BOOKING CANCELLATION
// ==================================================

test("DELETE /api/bookings/:id should reject unauthenticated requests", async () => {
  await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .expect(401);
});

test("DELETE /api/bookings/:id should cancel a booking", async () => {
  const response = await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(200);

  assert.equal(response.body.status, "CANCELLED");
  assert.equal(response.body.bookingId, bookingId);
});

test("DELETE /api/bookings/:id should reject repeated cancellation", async () => {
  await request(app)
    .delete(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(400);
});

test("PUT /api/bookings/:id should reject updates to cancelled bookings", async () => {
  await request(app)
    .put(`/api/bookings/${bookingId}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ seats: ["A01"] })
    .expect(400);
});

test("DELETE /api/bookings/:id should return 404 for a missing booking", async () => {
  await request(app)
    .delete(`/api/bookings/${new ObjectId()}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(404);
});

test("A cancelled booking should release its seats for another customer", async () => {
  const response = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .send({
      showtimeId: showtimeId.toString(),
      seats: ["A03"]
    })
    .expect(201);

  assert.deepEqual(response.body.seats, ["A03"]);
});

// ==================================================
// 13. MOVIE MANAGEMENT & BOOKING RESTRICTIONS
// ==================================================

const { archiveExpiredMovies, todayString, addDays } =
  await import("../src/utils/movieUtils.js");

async function createMovieWithShowtime(fields) {
  const db = getDb();
  const movie = {
    _id: new ObjectId(),
    title: `Rules Movie ${new ObjectId()}`,
    description: "",
    genre: "Action",
    duration: 100,
    rating: "PG",
    poster: "",
    archived: false,
    ...fields
  };
  movie.titleKey = movie.title.toLowerCase();
  movie.releaseYear = String(movie.releaseDate).slice(0, 4);
  await db.collection("movies").insertOne(movie);

  const showtime = {
    _id: new ObjectId(),
    movieId: movie._id,
    hallId,
    date: movie.releaseDate,
    startTime: "18:00",
    price: 15,
    status: "ACTIVE"
  };
  await db.collection("showtimes").insertOne(showtime);

  return { movie, showtime };
}

async function tryBooking(showtime) {
  return request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ showtimeId: showtime._id.toString(), seats: ["A01"] });
}

test("POST /api/movies should reject an end date earlier than the start date", async () => {
  const response = await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Bad Dates Movie",
      genre: "Drama",
      rating: "PG",
      releaseDate: "2027-03-10",
      endDate: "2027-03-01"
    })
    .expect(400);

  assert.match(response.body.message, /End date cannot be earlier/);
});

test("PUT /api/movies/:id should reject an end date earlier than the start date", async () => {
  const { movie } = await createMovieWithShowtime({
    releaseDate: "2027-04-10",
    endDate: "2027-04-20"
  });

  await request(app)
    .put(`/api/movies/${movie._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ endDate: "2027-04-01" })
    .expect(400);
});

test("POST /api/movies should only accept genres and ratings from the lists", async () => {
  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title: "Odd Genre Movie", genre: "Not A Genre", rating: "PG", releaseDate: "2027-05-01" })
    .expect(400);

  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title: "Odd Rating Movie", genre: "Drama", rating: "Z", releaseDate: "2027-05-01" })
    .expect(400);
});

test("POST /api/movies should prevent duplicate movie records", async () => {
  const payload = {
    title: "Duplicate Check Movie",
    genre: "Comedy",
    rating: "PG",
    releaseDate: "2027-06-01",
    endDate: "2027-06-30"
  };

  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(payload)
    .expect(201);

  const duplicate = await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...payload, title: "  duplicate CHECK movie " })
    .expect(409);

  assert.equal(duplicate.body.code, "DUPLICATE_MOVIE");

  // The same title in a different release year is a different movie.
  await request(app)
    .post("/api/movies")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...payload, releaseDate: "2028-06-01", endDate: "2028-06-30" })
    .expect(201);
});

test("GET /api/movies should return calculated statuses and hide archived movies", async () => {
  const today = todayString();
  const upcoming = await createMovieWithShowtime({ releaseDate: addDays(today, 10), endDate: addDays(today, 40) });
  const showing = await createMovieWithShowtime({ releaseDate: addDays(today, -5), endDate: addDays(today, 5) });
  const ended = await createMovieWithShowtime({ releaseDate: addDays(today, -30), endDate: addDays(today, -2) });
  const archived = await createMovieWithShowtime({ releaseDate: addDays(today, -30), endDate: addDays(today, -2), archived: true });

  const response = await request(app).get("/api/movies").expect(200);
  const byId = id => response.body.find(item => item._id === id.toString());

  assert.equal(byId(upcoming.movie._id).status, "COMING_SOON");
  assert.equal(byId(showing.movie._id).status, "NOW_SHOWING");
  assert.equal(byId(ended.movie._id).status, "ENDED");
  assert.equal(byId(archived.movie._id), undefined);
});

test("POST /api/bookings should reject a Coming Soon movie", async () => {
  const today = todayString();
  const { showtime } = await createMovieWithShowtime({ releaseDate: addDays(today, 10), endDate: addDays(today, 40) });

  const response = await tryBooking(showtime);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "MOVIE_COMING_SOON");
});

test("POST /api/bookings should reject an Ended movie", async () => {
  const today = todayString();
  const { showtime } = await createMovieWithShowtime({ releaseDate: addDays(today, -30), endDate: addDays(today, -1) });

  const response = await tryBooking(showtime);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "MOVIE_ENDED");
});

test("POST /api/bookings should reject an Archived movie", async () => {
  const today = todayString();
  const { showtime } = await createMovieWithShowtime({ releaseDate: addDays(today, -5), endDate: addDays(today, 5), archived: true });

  const response = await tryBooking(showtime);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "MOVIE_ARCHIVED");
});

test("POST /api/bookings should accept a movie on its last day", async () => {
  const today = todayString();

  const { showtime } = await createMovieWithShowtime({
    releaseDate: addDays(today, -5),
    endDate: today
  });

  // The showtime must also be today and in the future.
  showtime.date = today;
  showtime.startTime = "23:59";

  await getDb().collection("showtimes").updateOne(
    { _id: showtime._id },
    {
      $set: {
        date: today,
        startTime: "23:59"
      }
    }
  );

  const response = await tryBooking(showtime);
  assert.equal(response.status, 201);
});

test("DELETE and archive should refuse a movie with bookings", async () => {
  const today = todayString();
  const { movie, showtime } = await createMovieWithShowtime({
    releaseDate: addDays(today, -5),
    endDate: addDays(today, 5)
  });

  await getDb().collection("bookings").insertOne({
    userId: new ObjectId(),
    showtimeId: showtime._id,
    seats: ["B01"],
    status: "CANCELLED",
    totalAmount: 15,
    createdAt: new Date()
  });

  const refusedDelete = await request(app)
    .delete(`/api/movies/${movie._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(409);

  assert.equal(refusedDelete.body.code, "MOVIE_HAS_BOOKINGS");
  assert.equal(refusedDelete.body.bookingCount, 1);

  const refusedArchive = await request(app)
    .put(`/api/movies/${movie._id}/archive`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(409);

  assert.equal(refusedArchive.body.code, "MOVIE_HAS_BOOKINGS");
  assert.equal(refusedArchive.body.bookingCount, 1);

  const unchangedMovie = await getDb()
    .collection("movies")
    .findOne({ _id: movie._id });

  assert.equal(unchangedMovie.archived, false);
});

test("Archive and restore should reject customer access", async () => {
  await request(app)
    .put(`/api/movies/${movieId}/archive`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(403);
});

test("DELETE /api/movies/:id should remove a movie without bookings and its showtimes", async () => {
  const today = todayString();
  const { movie, showtime } = await createMovieWithShowtime({ releaseDate: addDays(today, -5), endDate: addDays(today, 5) });

  await request(app)
    .delete(`/api/movies/${movie._id}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  assert.equal(await getDb().collection("showtimes").findOne({ _id: showtime._id }), null);
});

test("POST /api/showtimes should reject dates outside the movie's availability", async () => {
  const today = todayString();
  const { movie } = await createMovieWithShowtime({ releaseDate: addDays(today, 1), endDate: addDays(today, 10) });

  for (const date of [today, addDays(today, 11)]) {
    await request(app)
      .post("/api/showtimes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ movieId: movie._id.toString(), hallId: hallId.toString(), date, startTime: "20:00", price: 20 })
      .expect(400);
  }
});

test("archiveExpiredMovies should archive long-ended movies only", async () => {
  const today = todayString();
  const longEnded = await createMovieWithShowtime({ releaseDate: addDays(today, -90), endDate: addDays(today, -45) });
  const recentlyEnded = await createMovieWithShowtime({ releaseDate: addDays(today, -60), endDate: addDays(today, -5) });
  const restored = await createMovieWithShowtime({ releaseDate: addDays(today, -90), endDate: addDays(today, -45), restoredAt: new Date() });

  await archiveExpiredMovies(getDb(), { today, afterDays: 30 });

  const movies = getDb().collection("movies");
  assert.equal((await movies.findOne({ _id: longEnded.movie._id })).archived, true);
  assert.equal((await movies.findOne({ _id: recentlyEnded.movie._id })).archived, false);
  assert.equal((await movies.findOne({ _id: restored.movie._id })).archived, false);
});
// ==================================================
// AUDIT REGRESSION TESTS
// ==================================================

const asAdmin = req => req.set("Authorization", `Bearer ${adminToken}`);

async function createHallViaApi(fields = {}) {
  return asAdmin(request(app).post("/api/halls")).send({
    name: `Audit Hall ${new ObjectId()}`.slice(0, 40),
    rows: 3,
    seatsPerRow: 4,
    ...fields
  });
}

// Inserts a long-running movie so showtimes can be created for any future date.
async function createWideMovie(duration = 120) {
  const today = todayString();
  const { movie } = await createMovieWithShowtime({
    releaseDate: addDays(today, -1),
    endDate: addDays(today, 90),
    duration
  });
  await getDb().collection("showtimes").deleteMany({ movieId: movie._id });
  return movie;
}

function postShowtime(movie, hall, date, startTime) {
  return asAdmin(request(app).post("/api/showtimes")).send({
    movieId: movie._id.toString(),
    hallId: String(hall._id),
    date,
    startTime,
    price: 15
  });
}

test("REGRESSION: POST /api/halls keeps a custom cleaning time of 30", async () => {
  const created = await createHallViaApi({ cleaningMinutes: 30 }).then(r => {
    assert.equal(r.status, 201);
    return r.body;
  });

  // Response, database and a fresh list all agree (survives a "refresh").
  assert.equal(created.cleaningMinutes, 30);
  const stored = await getDb().collection("halls").findOne({ _id: new ObjectId(created._id) });
  assert.equal(stored.cleaningMinutes, 30);

  const list = await request(app).get("/api/halls").expect(200);
  assert.equal(list.body.find(h => h._id === created._id).cleaningMinutes, 30);
});

test("REGRESSION: POST /api/halls accepts 0 minutes and string input", async () => {
  const zero = await createHallViaApi({ cleaningMinutes: 0 });
  assert.equal(zero.status, 201);
  assert.equal(zero.body.cleaningMinutes, 0);

  const text = await createHallViaApi({ cleaningMinutes: "25" });
  assert.equal(text.status, 201);
  assert.equal(text.body.cleaningMinutes, 25);
});

test("POST /api/halls defaults to 20 minutes only when none is supplied", async () => {
  const response = await createHallViaApi();
  assert.equal(response.status, 201);
  assert.equal(response.body.cleaningMinutes, 20);

  const stored = await getDb().collection("halls").findOne({ _id: new ObjectId(response.body._id) });
  assert.equal(stored.cleaningMinutes, 20);
  assert.equal(stored.status, "ACTIVE");
});

test("POST /api/halls rejects an invalid cleaning time", async () => {
  for (const cleaningMinutes of [-1, 31, 1.5, "abc"]) {
    const response = await createHallViaApi({ cleaningMinutes });
    assert.equal(response.status, 400, `cleaningMinutes=${cleaningMinutes}`);
  }
});

test("PUT /api/halls/:id updates and persists the cleaning time", async () => {
  const hall = (await createHallViaApi({ cleaningMinutes: 10 })).body;

  const updated = await asAdmin(request(app).put(`/api/halls/${hall._id}`))
    .send({ cleaningMinutes: 30 })
    .expect(200);
  assert.equal(updated.body.cleaningMinutes, 30);

  const list = await request(app).get("/api/halls").expect(200);
  assert.equal(list.body.find(h => h._id === hall._id).cleaningMinutes, 30);
});

test("Showtime conflicts use the hall's own cleaning time", async () => {
  const movie = await createWideMovie(120);
  const date = addDays(todayString(), 20);

  const shortCleaning = (await createHallViaApi({ cleaningMinutes: 0 })).body;
  await postShowtime(movie, shortCleaning, date, "10:00").expect(201); // ends 12:00
  await postShowtime(movie, shortCleaning, date, "12:00").expect(201); // 0 min gap is fine

  const longCleaning = (await createHallViaApi({ cleaningMinutes: 30 })).body;
  await postShowtime(movie, longCleaning, date, "10:00").expect(201); // free at 12:30
  const clash = await postShowtime(movie, longCleaning, date, "12:20").expect(409);
  assert.equal(clash.body.code, "SHOWTIME_CONFLICT");
  assert.match(clash.body.message, /12:30/);
  await postShowtime(movie, longCleaning, date, "12:30").expect(201);
});

test("Different halls may run showings at the same time", async () => {
  const movie = await createWideMovie(120);
  const date = addDays(todayString(), 21);
  const hallA = (await createHallViaApi()).body;
  const hallB = (await createHallViaApi()).body;

  await postShowtime(movie, hallA, date, "15:00").expect(201);
  await postShowtime(movie, hallB, date, "15:00").expect(201);
  await postShowtime(movie, hallA, date, "15:00").expect(409);
});

test("A late showing that runs past midnight blocks an early showing next day", async () => {
  const movie = await createWideMovie(120);
  const date = addDays(todayString(), 22);
  const hall = (await createHallViaApi({ cleaningMinutes: 20 })).body;

  await postShowtime(movie, hall, date, "23:00").expect(201); // ends 01:00, free 01:20
  await postShowtime(movie, hall, addDays(date, 1), "00:30").expect(409);
  await postShowtime(movie, hall, addDays(date, 1), "01:20").expect(201);
});

test("Malformed ids return 400 instead of 500", async () => {
  await request(app).get("/api/movies/not-an-id").expect(400);
  await request(app).get("/api/showtimes?movieId=nope").expect(400);
  await request(app)
    .get("/api/bookings/not-an-id")
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(400);
  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ showtimeId: "nope", seats: ["A01"] })
    .expect(400);
  await asAdmin(request(app).put("/api/movies/not-an-id")).send({}).expect(400);
});

test("GET /api/bookings/:id includes the movie, showtime and hall for the ticket", async () => {
  const movie = await createWideMovie(100);
  const hall = (await createHallViaApi()).body;
  const date = addDays(todayString(), 23);
  const created = await postShowtime(movie, hall, date, "18:00").expect(201);

  const booking = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ showtimeId: created.body._id, seats: ["A01"] })
    .expect(201);

  const detail = await request(app)
    .get(`/api/bookings/${booking.body._id}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(200);

  assert.equal(detail.body.movie.title, movie.title);
  assert.equal(detail.body.hall.name, hall.name);
  assert.equal(detail.body.showtime.startTime, "18:00");
  assert.deepEqual(detail.body.seats, ["A01"]);
});

test("CONCURRENCY: simultaneous requests for one seat produce exactly one booking", async () => {
  const movie = await createWideMovie(100);
  const hall = (await createHallViaApi()).body;
  const date = addDays(todayString(), 24);
  const created = await postShowtime(movie, hall, date, "20:00").expect(201);
  const showtime = created.body._id;

  const attempt = token =>
    request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ showtimeId: showtime, seats: ["B02"] });

  const tokens = [customerToken, secondCustomerToken];
  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, i) => attempt(tokens[i % 2]))
  );

  const statuses = responses.map(r => r.status);
  assert.equal(statuses.filter(s => s === 201).length, 1, `statuses: ${statuses}`);
  assert.equal(statuses.filter(s => s === 409).length, 11, `statuses: ${statuses}`);

  const stored = await getDb().collection("bookings")
    .countDocuments({ showtimeId: new ObjectId(showtime), status: "CONFIRMED", seats: "B02" });
  assert.equal(stored, 1);
});

test("CONCURRENCY: overlapping multi-seat requests never double-book a seat", async () => {
  const movie = await createWideMovie(100);
  const hall = (await createHallViaApi()).body;
  const date = addDays(todayString(), 25);
  const created = await postShowtime(movie, hall, date, "21:00").expect(201);
  const showtime = created.body._id;

  const book = (token, seats) =>
    request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ showtimeId: showtime, seats });

  const responses = await Promise.all([
    book(customerToken, ["A01", "A02"]),
    book(secondCustomerToken, ["A02", "A03"]),
    book(customerToken, ["A03", "A04"]),
    book(secondCustomerToken, ["A04", "A01"])
  ]);

  const confirmed = await getDb().collection("bookings")
    .find({ showtimeId: new ObjectId(showtime), status: "CONFIRMED" }).toArray();
  const seats = confirmed.flatMap(b => b.seats);
  assert.equal(new Set(seats).size, seats.length, "a seat was booked twice");
  assert.equal(confirmed.length, responses.filter(r => r.status === 201).length);
  assert.ok(responses.every(r => [201, 409].includes(r.status)));
});

test("A cancelled booking releases its seat for another customer", async () => {
  const movie = await createWideMovie(100);
  const hall = (await createHallViaApi()).body;
  const date = addDays(todayString(), 26);
  const created = await postShowtime(movie, hall, date, "17:00").expect(201);

  const first = await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ showtimeId: created.body._id, seats: ["C01"] })
    .expect(201);

  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .send({ showtimeId: created.body._id, seats: ["C01"] })
    .expect(409);

  await request(app)
    .delete(`/api/bookings/${first.body._id}`)
    .set("Authorization", `Bearer ${customerToken}`)
    .expect(200);

  await request(app)
    .post("/api/bookings")
    .set("Authorization", `Bearer ${secondCustomerToken}`)
    .send({ showtimeId: created.body._id, seats: ["C01"] })
    .expect(201);
});