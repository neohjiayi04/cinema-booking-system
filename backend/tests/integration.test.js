
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
    date: "2026-11-20",
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
      date: "2026-12-01",
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
      date: "2026-12-05",
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
      date: "2026-12-10",
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
