import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "./db.js";
import { config } from "./config.js";
import {
  hashPassword,
  verifyPassword,
  createToken,
  requireAuth,
  requireAdmin,
} from "./auth.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function id(value) {
  return new ObjectId(value);
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "cinema-booking-backend" });
});

// ---------------- AUTH ----------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ message: "Name, email and password (8+ chars) are required" });
    }

    const users = getDb().collection("users");
    const normalizedEmail = email.trim().toLowerCase();

    if (await users.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      role: "customer",
      createdAt: new Date()
    };

    const result = await users.insertOne(user);
    user._id = result.insertedId;

    res.status(201).json({
      user: safeUser(user),
      token: createToken(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getDb().collection("users").findOne({
      email: String(email || "").trim().toLowerCase()
    });

    if (!user || !(await verifyPassword(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ user: safeUser(user), token: createToken(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});


app.put("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!name || name.length > 100) {
      return res.status(400).json({
        message: "Name is required and must be 100 characters or fewer."
      });
    }

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        message: "Please provide a valid email address."
      });
    }

    const users = getDb().collection("users");
    const currentUserId = new ObjectId(req.user.id);

    const existingUser = await users.findOne({
      email,
      _id: { $ne: currentUserId }
    });

    if (existingUser) {
      return res.status(409).json({
        message: "This email address is already registered."
      });
    }

    const result = await users.updateOne(
      { _id: currentUserId },
      {
        $set: {
          name,
          email
        }
      }
    );

    if (!result.matchedCount) {
      return res.status(404).json({
        message: "User account not found."
      });
    }

    const updatedUser = await users.findOne({
      _id: currentUserId
    });

    res.json({
      message: "Profile updated successfully.",
      user: safeUser(updatedUser)
    });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(500).json({
      message: "Unable to update your profile."
    });
  }
});

// ---------------- MOVIES ----------------
app.get("/api/movies", async (_req, res) => {
  const movies = await getDb().collection("movies").find({}).sort({ releaseDate: -1 }).toArray();
  res.json(movies);
});

app.get("/api/movies/:id", async (req, res) => {
  const movie = await getDb().collection("movies").findOne({ _id: id(req.params.id) });
  if (!movie) return res.status(404).json({ message: "Movie not found" });
  res.json(movie);
});

app.post("/api/movies", requireAuth, requireAdmin, async (req, res) => {
  const { title, description, genre, duration, rating, poster, releaseDate, status } = req.body;
  if (!title) return res.status(400).json({ message: "Title is required" });

  const movie = {
    title, description: description || "", genre: genre || "General",
    duration: Number(duration || 120), rating: rating || "PG",
    poster: poster || "", releaseDate: releaseDate || new Date().toISOString().slice(0, 10),
    status: status || "NOW_SHOWING", createdAt: new Date()
  };

  const result = await getDb().collection("movies").insertOne(movie);
  movie._id = result.insertedId;
  res.status(201).json(movie);
});

app.put("/api/movies/:id", requireAuth, requireAdmin, async (req, res) => {
  const allowed = ["title", "description", "genre", "duration", "rating", "poster", "releaseDate", "status"];
  const update = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];

  const result = await getDb().collection("movies").findOneAndUpdate(
    { _id: id(req.params.id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) return res.status(404).json({ message: "Movie not found" });
  res.json(result);
});

app.delete("/api/movies/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await getDb().collection("movies").deleteOne({ _id: id(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: "Movie not found" });
  res.json({ message: "Movie deleted" });
});

// ---------------- HALLS ----------------
app.get("/api/halls", async (_req, res) => {
  const halls = await getDb().collection("halls").find({}).sort({ name: 1 }).toArray();
  res.json(halls);
});

app.post("/api/halls", requireAuth, requireAdmin, async (req, res) => {
  const { name, rows, seatsPerRow } = req.body;
  if (!name || !rows || !seatsPerRow) return res.status(400).json({ message: "Hall data is required" });

  const hall = { name, rows: Number(rows), seatsPerRow: Number(seatsPerRow), createdAt: new Date() };
  const result = await getDb().collection("halls").insertOne(hall);
  hall._id = result.insertedId;
  res.status(201).json(hall);
});

app.put("/api/halls/:id", requireAuth, requireAdmin, async (req, res) => {
  const update = {};
  for (const key of ["name", "rows", "seatsPerRow"]) if (req.body[key] !== undefined) update[key] = Number.isNaN(Number(req.body[key])) ? req.body[key] : Number(req.body[key]);
  const result = await getDb().collection("halls").findOneAndUpdate(
    { _id: id(req.params.id) }, { $set: update }, { returnDocument: "after" }
  );
  if (!result) return res.status(404).json({ message: "Hall not found" });
  res.json(result);
});

app.delete("/api/halls/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await getDb().collection("halls").deleteOne({ _id: id(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: "Hall not found" });
  res.json({ message: "Hall deleted" });
});

// ---------------- SHOWTIMES ----------------
app.get("/api/showtimes", async (req, res) => {
  const filter = req.query.movieId ? { movieId: id(req.query.movieId) } : {};
  const rows = await getDb().collection("showtimes").aggregate([
    { $match: filter },
    { $sort: { date: 1, startTime: 1 } },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $lookup: { from: "halls", localField: "hallId", foreignField: "_id", as: "hall" } },
    { $unwind: "$hall" }
  ]).toArray();

  res.json(rows);
});

app.get("/api/showtimes/:id", async (req, res) => {
  const rows = await getDb().collection("showtimes").aggregate([
    { $match: { _id: id(req.params.id) } },
    { $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $lookup: { from: "halls", localField: "hallId", foreignField: "_id", as: "hall" } },
    { $unwind: "$hall" }
  ]).toArray();

  if (!rows[0]) return res.status(404).json({ message: "Showtime not found" });

  const bookings = await getDb().collection("bookings").find({
    showtimeId: id(req.params.id),
    status: "CONFIRMED"
  }).toArray();

  const bookedSeats = bookings.flatMap(b => b.seats);
  res.json({ ...rows[0], bookedSeats });
});

app.post("/api/showtimes", requireAuth, requireAdmin, async (req, res) => {
  const { movieId, hallId, date, startTime, price } = req.body;
  if (!movieId || !hallId || !date || !startTime) {
    return res.status(400).json({ message: "Movie, hall, date and time are required" });
  }

  const showtime = {
    movieId: id(movieId), hallId: id(hallId), date, startTime,
    price: Number(price || 18), status: "ACTIVE", createdAt: new Date()
  };

  const result = await getDb().collection("showtimes").insertOne(showtime);
  showtime._id = result.insertedId;
  res.status(201).json(showtime);
});

app.put("/api/showtimes/:id", requireAuth, requireAdmin, async (req, res) => {
  const update = {};
  for (const key of ["date", "startTime", "price", "status"]) {
    if (req.body[key] !== undefined) update[key] = key === "price" ? Number(req.body[key]) : req.body[key];
  }
  if (req.body.movieId) update.movieId = id(req.body.movieId);
  if (req.body.hallId) update.hallId = id(req.body.hallId);

  const result = await getDb().collection("showtimes").findOneAndUpdate(
    { _id: id(req.params.id) }, { $set: update }, { returnDocument: "after" }
  );
  if (!result) return res.status(404).json({ message: "Showtime not found" });
  res.json(result);
});

app.delete("/api/showtimes/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await getDb().collection("showtimes").deleteOne({ _id: id(req.params.id) });
  if (!result.deletedCount) return res.status(404).json({ message: "Showtime not found" });
  res.json({ message: "Showtime deleted" });
});

// ---------------- BOOKINGS ----------------
app.get("/api/bookings/my", requireAuth, async (req, res) => {
  const bookings = await getDb().collection("bookings").aggregate([
    { $match: { userId: id(req.user.id) } },
    { $sort: { createdAt: -1 } },
    { $lookup: { from: "showtimes", localField: "showtimeId", foreignField: "_id", as: "showtime" } },
    { $unwind: "$showtime" },
    { $lookup: { from: "movies", localField: "showtime.movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" },
    { $lookup: { from: "halls", localField: "showtime.hallId", foreignField: "_id", as: "hall" } },
    { $unwind: "$hall" }
  ]).toArray();

  res.json(bookings);
});

app.get("/api/bookings", requireAuth, requireAdmin, async (_req, res) => {
  const bookings = await getDb().collection("bookings").aggregate([
    { $sort: { createdAt: -1 } },
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    { $lookup: { from: "showtimes", localField: "showtimeId", foreignField: "_id", as: "showtime" } },
    { $unwind: "$showtime" },
    { $lookup: { from: "movies", localField: "showtime.movieId", foreignField: "_id", as: "movie" } },
    { $unwind: "$movie" }
  ]).toArray();

  res.json(bookings);
});

// Admin: list registered users (used by the dashboard count)
app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  const users = await getDb()
    .collection("users")
    .find({})
    .sort({ _id: -1 })
    .toArray();

  res.json(users.map(safeUser));
});

function generateReference() {
  const d = new Date();
  const stamp = d.toISOString().replace(/\D/g, "").slice(0, 14);
  return `BK-${stamp}-${Math.floor(100 + Math.random() * 900)}`;
}

app.post("/api/bookings", requireAuth, async (req, res) => {
  try {
    const { showtimeId, seats } = req.body;

    if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        message: "Showtime and at least one seat are required"
      });
    }

    const uniqueSeats = [...new Set(seats)];

    const showtime = await getDb()
      .collection("showtimes")
      .findOne({ _id: id(showtimeId) });

    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    const hall = await getDb()
      .collection("halls")
      .findOne({ _id: showtime.hallId });

    if (!hall) {
      return res.status(404).json({ message: "Hall not found" });
    }

    // Validate seats
    const validSeats = new Set();

    for (let r = 0; r < hall.rows; r++) {
      const row = String.fromCharCode(65 + r);

      for (let s = 1; s <= hall.seatsPerRow; s++) {
        validSeats.add(
          `${row}${String(s).padStart(2, "0")}`
        );
      }
    }

    if (uniqueSeats.some(seat => !validSeats.has(seat))) {
      return res.status(400).json({
        message: "One or more seats are invalid"
      });
    }

    // Retrieve the authenticated user
    const user = await getDb()
      .collection("users")
      .findOne({ _id: id(req.user.id) });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalAmount = uniqueSeats.length * Number(showtime.price);

    const bookingReference = generateReference();

    const booking = {
      bookingReference,
      userId: id(req.user.id),
      username: user.name,
      showtimeId,
      seats: uniqueSeats,
      totalAmount,
      status: "CONFIRMED",
      createdAt: new Date()
    };

    const result = await getDb()
      .collection("bookings")
      .insertOne(booking);

    booking._id = result.insertedId;

    broadcastToShowtime(showtimeId, {
      type: "SEAT_BOOKED",
      showtimeId,
      seats: uniqueSeats
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "One or more selected seats have just been booked by another customer. Please refresh the seat map."
      });
    }

    console.error(error);
    res.status(500).json({ message: "Booking failed" });
  }
});

app.get("/api/bookings/:id", requireAuth, async (req, res) => {
  const booking = await getDb().collection("bookings").findOne({ _id: id(req.params.id) });
  if (!booking) return res.status(404).json({ message: "Booking not found" });

  if (req.user.role !== "admin" && booking.userId.toString() !== req.user.id) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(booking);
});

/* ---------------- UPDATE BOOKING SEATS ---------------- */
app.put("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const bookingId = id(req.params.id);
    const userId = id(req.user.id);
    const { seats } = req.body;

    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        message: "Please select at least one seat."
      });
    }

    const uniqueSeats = [...new Set(
      seats.map(seat => String(seat).trim().toUpperCase())
    )];

    if (uniqueSeats.length !== seats.length) {
      return res.status(400).json({
        message: "Duplicate seats are not allowed."
      });
    }

    const bookings = getDb().collection("bookings");

    const booking = await bookings.findOne({
      _id: bookingId,
      userId
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found or you do not have permission to modify it."
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        message: "Only confirmed bookings can be modified."
      });
    }

    const showtime = await getDb().collection("showtimes").findOne({
      _id: booking.showtimeId
    });

    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found." });
    }

    const hall = await getDb().collection("halls").findOne({
      _id: showtime.hallId
    });

    if (!hall) {
      return res.status(404).json({ message: "Hall not found." });
    }

    const validSeats = new Set();

    for (let r = 0; r < hall.rows; r++) {
      const row = String.fromCharCode(65 + r);

      for (let s = 1; s <= hall.seatsPerRow; s++) {
        validSeats.add(`${row}${String(s).padStart(2, "0")}`);
      }
    }

    if (uniqueSeats.some(seat => !validSeats.has(seat))) {
      return res.status(400).json({
        message: "One or more selected seats are invalid."
      });
    }

    // Find seats held by other confirmed bookings for this showtime.
    const otherBookings = await bookings.find({
      showtimeId: booking.showtimeId,
      status: "CONFIRMED",
      _id: { $ne: booking._id }
    }).toArray();

    const occupiedSeats = new Set(
      otherBookings.flatMap(item => item.seats || [])
    );

    const unavailable = uniqueSeats.filter(seat =>
      occupiedSeats.has(seat)
    );

    if (unavailable.length > 0) {
      return res.status(409).json({
        message: `These seats are already booked: ${unavailable.join(", ")}.`
      });
    }

    const result = await bookings.updateOne(
      {
        _id: booking._id,
        userId,
        status: "CONFIRMED",
        seats: booking.seats
      },
      {
        $set: {
          seats: uniqueSeats,
          totalAmount: uniqueSeats.length * Number(showtime.price),
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        message: "The booking changed while you were editing it. Please refresh and try again."
      });
    }

    // Tell connected seat maps to refresh availability.
    broadcastToShowtime(String(booking.showtimeId), {
      type: "SEATS_UPDATED",
      showtimeId: String(booking.showtimeId),
      seats: [...new Set([...(booking.seats || []), ...uniqueSeats])]
    });

    const updatedBooking = await bookings.findOne({
      _id: booking._id
    });

    res.json(updatedBooking);
  } catch (error) {
    console.error("Update booking error:", error);
    res.status(500).json({
      message: "Failed to update booking seats."
    });
  }
});

/* ---------------- CANCEL BOOKING ---------------- */
app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const bookingId = id(req.params.id);
    const userId = id(req.user.id);
    const bookings = getDb().collection("bookings");

    const booking = await bookings.findOne({
      _id: bookingId,
      userId
    });

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found or you do not have permission to cancel it."
      });
    }

    if (booking.status !== "CONFIRMED") {
      return res.status(400).json({
        message: "This booking has already been cancelled or is no longer active."
      });
    }

    const result = await bookings.updateOne(
      {
        _id: booking._id,
        userId,
        status: "CONFIRMED"
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({
        message: "This booking has already changed. Please refresh your bookings."
      });
    }

    broadcastToShowtime(String(booking.showtimeId), {
      type: "SEATS_RELEASED",
      showtimeId: String(booking.showtimeId),
      seats: booking.seats || []
    });

    res.json({
      message: "Booking cancelled successfully.",
      bookingId: String(booking._id),
      status: "CANCELLED"
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({
      message: "Failed to cancel booking."
    });
  }
});


// ---------------- HTTP + WEBSOCKET ----------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();

function broadcastToShowtime(showtimeId, payload) {
  const set = rooms.get(String(showtimeId));
  if (!set) return;

  const message = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(message);
  }
}

wss.on("connection", ws => {
  ws.currentRoom = null;

  ws.send(JSON.stringify({
    type: "CONNECTED",
    message: "WebSocket connected to Cinema Booking System"
  }));

  ws.on("message", raw => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "JOIN_SHOWTIME" && message.showtimeId) {
        const room = String(message.showtimeId);

        if (ws.currentRoom && rooms.has(ws.currentRoom)) {
          rooms.get(ws.currentRoom).delete(ws);
        }

        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);
        ws.currentRoom = room;

        ws.send(JSON.stringify({
          type: "JOINED_SHOWTIME",
          showtimeId: room
        }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "ERROR", message: "Invalid WebSocket message" }));
    }
  });

  ws.on("close", () => {
    if (ws.currentRoom && rooms.has(ws.currentRoom)) {
      rooms.get(ws.currentRoom).delete(ws);
      if (rooms.get(ws.currentRoom).size === 0) rooms.delete(ws.currentRoom);
    }
  });
});

await connectDb();

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Cinema backend running on port ${config.port}`);
});
