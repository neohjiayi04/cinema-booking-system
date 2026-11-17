import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import {
  hashPassword,
  verifyPassword,
  createToken,
  requireAuth,
  requireAdmin
} from "./auth.js";
import {
  MOVIE_STATUS,
  decorateMovie,
  getMovieStatus,
  bookingBlockedMessage,
  normalizeTitle,
  releaseYear,
  validateMovie,
  pickMovieFields,
  showtimeDateProblem,
  todayString
} from "./utils/movieUtils.js";
import {
  HALL_STATUS,
  decorateHall,
  hallStatus,
  isValidTime,
  isValidDate,
  isShowtimePast,
  isShowtimeUpcoming,
  findShowtimeConflict,
  conflictMessage,
  pickHallFields,
  validateHall
} from "./utils/showtimeUtils.js";
import { generateValidSeats } from "./utils/seatUtils.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function id(value) {
  return new ObjectId(value);
}

function isObjectId(value) {
  return ObjectId.isValid(value);
}

function badId(res, label) {
  return res.status(400).json({ message: `Invalid ${label} id.` });
}

async function getHallBookingCount(hallId) {
  const db = getDb();
  const showtimeIds = await db.collection("showtimes")
    .find({ hallId }, { projection: { _id: 1 } })
    .map(item => item._id)
    .toArray();
  if (!showtimeIds.length) return 0;
  return db.collection("bookings").countDocuments({
    showtimeId: { $in: showtimeIds }
  });
}

async function getBookedSeatsForHall(hallId) {
  const db = getDb();
  const showtimeIds = await db.collection("showtimes")
    .find({ hallId }, { projection: { _id: 1 } })
    .map(item => item._id)
    .toArray();
  if (!showtimeIds.length) return [];

  const bookings = await db.collection("bookings")
    .find({ showtimeId: { $in: showtimeIds }, status: "CONFIRMED" }, { projection: { seats: 1 } })
    .toArray();
  return [...new Set(bookings.flatMap(item => item.seats || []))];
}

async function findShowtimeHallConflict(candidate, excludeId = null) {
  const db = getDb();
  const filter = { hallId: candidate.hallId, date: candidate.date };
  if (excludeId) filter._id = { $ne: excludeId };

  const rows = await db.collection("showtimes").aggregate([
    { $match: filter },
    {
      $lookup: {
        from: "movies",
        localField: "movieId",
        foreignField: "_id",
        as: "movie"
      }
    },
    { $unwind: "$movie" },
    {
      $project: {
        _id: 1,
        date: 1,
        startTime: 1,
        duration: "$movie.duration",
        title: "$movie.title"
      }
    }
  ]).toArray();

  const cleaningMinutes = 20;
  return findShowtimeConflict(candidate, rows, cleaningMinutes);
}

function validateShowtimeInput({ date, startTime, price }) {
  if (!isValidDate(date)) return "Please provide a valid showtime date.";
  if (!isValidTime(startTime)) return "Please provide a valid start time (HH:MM).";
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "Price must be a number greater than 0.";
  }
  return null;
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
      return res.status(400).json({
        message: "Name, email and password (8+ chars) are required"
      });
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
      { $set: { name, email } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ message: "User account not found." });
    }

    const updatedUser = await users.findOne({ _id: currentUserId });

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
// Statuses (COMING_SOON / NOW_SHOWING / ENDED) are calculated from the start and
// end dates on every request; only ARCHIVED is stored (archived: true).

// All bookings (any status) that belong to a movie, through its showtimes.
async function countBookingsForMovie(movieId) {
  const db = getDb();
  const showtimeIds = await db.collection("showtimes")
    .find({ movieId }, { projection: { _id: 1 } })
    .map(showtime => showtime._id)
    .toArray();

  if (!showtimeIds.length) return 0;

  return db.collection("bookings").countDocuments({ showtimeId: { $in: showtimeIds } });
}

// Same title (ignoring case, spacing and punctuation) released in the same year.
async function findDuplicateMovie(movie, excludeId = null) {
  const filter = {
    titleKey: normalizeTitle(movie.title),
    releaseYear: releaseYear(movie)
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return getDb().collection("movies").findOne(filter);
}

const duplicateMessage = existing =>
  `A movie called "${existing.title}" already exists for this release year. Edit that record instead of adding a duplicate.`;

// Public list. Archived movies are hidden. Optional ?status=NOW_SHOWING,COMING_SOON,ENDED
app.get("/api/movies", async (req, res) => {
  const today = todayString();
  const wanted = String(req.query.status || "")
    .split(",")
    .map(value => value.trim().toUpperCase())
    .filter(Boolean);

  const movies = await getDb().collection("movies")
    .find({})
    .sort({ releaseDate: -1 })
    .toArray();

  res.json(
    movies
      .map(movie => decorateMovie(movie, today))
      .filter(movie => movie.status !== MOVIE_STATUS.ARCHIVED)
      .filter(movie => !wanted.length || wanted.includes(movie.status))
  );
});

// Admin list: every movie, archived included, with its booking count.
app.get("/api/admin/movies", requireAuth, requireAdmin, async (_req, res) => {
  const db = getDb();
  const today = todayString();

  const [movies, showtimes, perShowtime] = await Promise.all([
    db.collection("movies").find({}).sort({ releaseDate: -1 }).toArray(),
    db.collection("showtimes").find({}, { projection: { _id: 1, movieId: 1 } }).toArray(),
    db.collection("bookings").aggregate([
      { $group: { _id: "$showtimeId", count: { $sum: 1 } } }
    ]).toArray()
  ]);

  const movieByShowtime = new Map(showtimes.map(s => [String(s._id), String(s.movieId)]));
  const bookingsByMovie = new Map();
  for (const row of perShowtime) {
    const movieKey = movieByShowtime.get(String(row._id));
    if (movieKey) bookingsByMovie.set(movieKey, (bookingsByMovie.get(movieKey) || 0) + row.count);
  }

  res.json(
    movies.map(movie => ({
      ...decorateMovie(movie, today),
      bookingCount: bookingsByMovie.get(String(movie._id)) || 0
    }))
  );
});

app.get("/api/movies/:id", async (req, res) => {
  const movie = await getDb().collection("movies")
    .findOne({ _id: id(req.params.id) });

  if (!movie || movie.archived === true) return res.status(404).json({ message: "Movie not found" });

  res.json(decorateMovie(movie));
});

app.post("/api/movies", requireAuth, requireAdmin, async (req, res) => {
  const input = pickMovieFields(req.body);

  if (!input.title) return res.status(400).json({ message: "Title is required" });

  const movie = {
    title: input.title,
    description: input.description || "",
    genre: input.genre || "General",
    duration: input.duration ?? 120,
    rating: input.rating || "PG",
    poster: input.poster || "",
    releaseDate: input.releaseDate || todayString(),
    endDate: input.endDate || null,
    archived: false,
    createdAt: new Date()
  };

  const problem = validateMovie(movie);
  if (problem) return res.status(400).json({ message: problem });

  const duplicate = await findDuplicateMovie(movie);
  if (duplicate) {
    return res.status(409).json({ message: duplicateMessage(duplicate), code: "DUPLICATE_MOVIE" });
  }

  movie.titleKey = normalizeTitle(movie.title);
  movie.releaseYear = releaseYear(movie);

  try {
    const result = await getDb().collection("movies").insertOne(movie);
    movie._id = result.insertedId;
  } catch (error) {
    // Two admins adding the same movie at the same moment: the unique index catches it.
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This movie already exists for this release year.", code: "DUPLICATE_MOVIE" });
    }
    throw error;
  }

  res.status(201).json(decorateMovie(movie));
});

app.put("/api/movies/:id", requireAuth, requireAdmin, async (req, res) => {
  const movies = getDb().collection("movies");
  const movieId = id(req.params.id);

  const existing = await movies.findOne({ _id: movieId });
  if (!existing) return res.status(404).json({ message: "Movie not found" });

  // `status` is calculated, so any status sent by the client is ignored.
  const update = pickMovieFields(req.body);
  const merged = { ...existing, ...update };

  const problem = validateMovie(merged, existing);
  if (problem) return res.status(400).json({ message: problem });

  // Changing the movie's availability must not strand existing showtimes outside
  // the new date range. Move/delete those showtimes first, then edit the movie.
  const existingShowtimes = await getDb().collection("showtimes")
    .find({ movieId }, { projection: { date: 1 } })
    .toArray();
  const invalidShowtime = existingShowtimes.find(showtime => {
    const day = String(showtime.date).slice(0, 10);
    return day < merged.releaseDate || (merged.endDate && day > merged.endDate);
  });
  if (invalidShowtime) {
    return res.status(409).json({
      message: `Movie dates cannot be changed because showtime ${String(invalidShowtime.date).slice(0, 10)} would fall outside the movie's availability.`,
      code: "MOVIE_DATES_CONFLICT_WITH_SHOWTIMES"
    });
  }

  const duplicate = await findDuplicateMovie(merged, movieId);
  if (duplicate) {
    return res.status(409).json({ message: duplicateMessage(duplicate), code: "DUPLICATE_MOVIE" });
  }

  update.titleKey = normalizeTitle(merged.title);
  update.releaseYear = releaseYear(merged);

  let result;
  try {
    result = await movies.findOneAndUpdate(
      { _id: movieId },
      { $set: update },
      { returnDocument: "after" }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This movie already exists for this release year.", code: "DUPLICATE_MOVIE" });
    }
    throw error;
  }

  if (!result) return res.status(404).json({ message: "Movie not found" });

  res.json(decorateMovie(result));
});

// Archive instead of delete: hides the movie from customers and blocks booking.
app.put("/api/movies/:id/archive", requireAuth, requireAdmin, async (req, res) => {
  const result = await getDb().collection("movies").findOneAndUpdate(
    { _id: id(req.params.id) },
    {
      $set: { archived: true, archivedAt: new Date() },
      $unset: { restoredAt: "" }
    },
    { returnDocument: "after" }
  );

  if (!result) return res.status(404).json({ message: "Movie not found" });

  res.json(decorateMovie(result));
});

// Un-archive. The movie returns to Coming Soon / Now Showing / Ended based on its dates.
// restoredAt stops the automatic archiver from archiving it again straight away.
app.put("/api/movies/:id/restore", requireAuth, requireAdmin, async (req, res) => {
  const result = await getDb().collection("movies").findOneAndUpdate(
    { _id: id(req.params.id) },
    {
      $set: { archived: false, restoredAt: new Date() },
      $unset: { archivedAt: "", autoArchived: "" }
    },
    { returnDocument: "after" }
  );

  if (!result) return res.status(404).json({ message: "Movie not found" });

  res.json(decorateMovie(result));
});

app.delete("/api/movies/:id", requireAuth, requireAdmin, async (req, res) => {
  const movies = getDb().collection("movies");
  const movieId = id(req.params.id);

  const movie = await movies.findOne({ _id: movieId });
  if (!movie) return res.status(404).json({ message: "Movie not found" });

  const bookingCount = await countBookingsForMovie(movieId);
  if (bookingCount > 0) {
    return res.status(409).json({
      message: `"${movie.title}" has ${bookingCount} existing booking${bookingCount === 1 ? "" : "s"} and can't be deleted. Archive it instead.`,
      code: "MOVIE_HAS_BOOKINGS",
      bookingCount
    });
  }

  // No bookings, so its (empty) showtimes can safely go with it.
  await getDb().collection("showtimes").deleteMany({ movieId });
  await movies.deleteOne({ _id: movieId });

  res.json({ message: "Movie deleted" });
});

// ---------------- HALLS ----------------
app.get("/api/halls", async (_req, res) => {
  const halls = await getDb().collection("halls")
    .find({})
    .sort({ name: 1 })
    .toArray();

  res.json(halls.map(decorateHall));
});

app.post("/api/halls", requireAuth, requireAdmin, async (req, res) => {
  const input = {
    name: String(req.body.name ?? "").trim(),
    rows: Number(req.body.rows),
    seatsPerRow: Number(req.body.seatsPerRow),
    status: String(req.body.status ?? HALL_STATUS.ACTIVE).toUpperCase()
  };

  const problem = validateHall(input);
  if (problem) return res.status(400).json({ message: problem });

  const hall = { ...input, createdAt: new Date() };
  const result = await getDb().collection("halls").insertOne(hall);
  hall._id = result.insertedId;

  res.status(201).json(decorateHall(hall));
});

app.put("/api/halls/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!isObjectId(req.params.id)) return badId(res, "hall");

  const halls = getDb().collection("halls");
  const hallId = id(req.params.id);
  const existing = await halls.findOne({ _id: hallId });
  if (!existing) return res.status(404).json({ message: "Hall not found" });

  const update = pickHallFields(req.body);
  const merged = {
    ...existing,
    ...update,
    status: update.status ?? hallStatus(existing)
  };

  const problem = validateHall(merged);
  if (problem) return res.status(400).json({ message: problem });

  const bookedSeats = await getBookedSeatsForHall(hallId);
  const newLayout = generateValidSeats(merged.rows, merged.seatsPerRow);
  const seatsOutside = bookedSeats.filter(seat => !newLayout.has(seat));
  if (seatsOutside.length) {
    return res.status(409).json({
      message: `The hall cannot shrink because these booked seats would no longer exist: ${seatsOutside.join(", ")}.`,
      code: "HALL_BOOKED_SEATS_OUTSIDE_LAYOUT",
      seats: seatsOutside
    });
  }

  const result = await halls.findOneAndUpdate(
    { _id: hallId },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) return res.status(404).json({ message: "Hall not found" });
  res.json(decorateHall(result));
});

app.delete("/api/halls/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!isObjectId(req.params.id)) return badId(res, "hall");

  const halls = getDb().collection("halls");
  const hallId = id(req.params.id);
  const hall = await halls.findOne({ _id: hallId });
  if (!hall) return res.status(404).json({ message: "Hall not found" });

  const upcoming = await getDb().collection("showtimes")
    .find({ hallId })
    .toArray();
  const upcomingShowtimes = upcoming.filter(showtime => isShowtimeUpcoming(showtime));
  if (upcomingShowtimes.length) {
    return res.status(409).json({
      message: `"${hall.name}" has ${upcomingShowtimes.length} upcoming showtime${upcomingShowtimes.length === 1 ? "" : "s"} and can't be deleted.`,
      code: "HALL_HAS_UPCOMING_SHOWTIMES",
      showtimeCount: upcomingShowtimes.length
    });
  }

  const bookingCount = await getHallBookingCount(hallId);
  if (bookingCount > 0) {
    return res.status(409).json({
      message: `"${hall.name}" has existing bookings and can't be deleted.`,
      code: "HALL_HAS_BOOKINGS",
      bookingCount
    });
  }

  await getDb().collection("showtimes").deleteMany({ hallId });
  await halls.deleteOne({ _id: hallId });
  res.json({ message: "Hall deleted" });
});

// ---------------- SHOWTIMES ----------------
app.get("/api/showtimes", async (req, res) => {
  const filter = req.query.movieId
    ? { movieId: id(req.query.movieId) }
    : {};

  const rows = await getDb().collection("showtimes").aggregate([
    { $match: filter },
    { $sort: { date: 1, startTime: 1 } },
    {
      $lookup: {
        from: "movies", localField: "movieId", foreignField: "_id", as: "movie"
      }
    },
    { $unwind: "$movie" },
    {
      $lookup: {
        from: "halls", localField: "hallId", foreignField: "_id", as: "hall"
      }
    },
    { $unwind: "$hall" }
  ]).toArray();

  const today = todayString();
  res.json(rows.map(row => ({
    ...row,
    movie: decorateMovie(row.movie, today),
    hall: decorateHall(row.hall)
  })));
});

app.get("/api/showtimes/:id", async (req, res) => {
  if (!isObjectId(req.params.id)) return badId(res, "showtime");

  const showtimeId = id(req.params.id);
  const rows = await getDb().collection("showtimes").aggregate([
    { $match: { _id: showtimeId } },
    {
      $lookup: { from: "movies", localField: "movieId", foreignField: "_id", as: "movie" }
    },
    { $unwind: "$movie" },
    {
      $lookup: { from: "halls", localField: "hallId", foreignField: "_id", as: "hall" }
    },
    { $unwind: "$hall" }
  ]).toArray();

  if (!rows[0]) return res.status(404).json({ message: "Showtime not found" });

  const bookings = await getDb().collection("bookings").find({
    showtimeId, status: "CONFIRMED"
  }).toArray();

  res.json({
    ...rows[0],
    movie: decorateMovie(rows[0].movie),
    hall: decorateHall(rows[0].hall),
    bookedSeats: [...new Set(bookings.flatMap(b => b.seats || []))]
  });
});

app.post("/api/showtimes", requireAuth, requireAdmin, async (req, res) => {
  const { movieId, hallId, date, startTime, price } = req.body;
  if (!movieId || !hallId || !date || !startTime) {
    return res.status(400).json({ message: "Movie, hall, date and time are required" });
  }
  if (!isObjectId(movieId)) return badId(res, "movie");
  if (!isObjectId(hallId)) return badId(res, "hall");

  const inputProblem = validateShowtimeInput({ date, startTime, price: price ?? 18 });
  if (inputProblem) return res.status(400).json({ message: inputProblem });

  const db = getDb();
  const movie = await db.collection("movies").findOne({ _id: id(movieId) });
  if (!movie) return res.status(404).json({ message: "Movie not found" });

  const hall = await db.collection("halls").findOne({ _id: id(hallId) });
  if (!hall) return res.status(404).json({ message: "Hall not found" });
  if (hallStatus(hall) === HALL_STATUS.INACTIVE) {
    return res.status(409).json({ message: `"${hall.name}" is inactive and can't receive showtimes.`, code: "HALL_INACTIVE" });
  }

  const dateProblem = showtimeDateProblem(movie, date);
  if (dateProblem) return res.status(400).json({ message: dateProblem });

  const candidate = {
    movieId: id(movieId),
    hallId: id(hallId),
    date,
    startTime,
    duration: Number(movie.duration),
    title: movie.title
  };

  if (isShowtimePast(date, startTime)) {
    return res.status(400).json({ message: "Showtime must start in the future." });
  }

  const conflict = await findShowtimeHallConflict(candidate);
  if (conflict) {
    return res.status(409).json({
      message: conflictMessage(hall, conflict, 20),
      code: "SHOWTIME_CONFLICT"
    });
  }

  const showtime = {
    movieId: id(movieId),
    hallId: id(hallId),
    date,
    startTime,
    price: Number(price ?? 18),
    status: "ACTIVE",
    createdAt: new Date()
  };

  const result = await db.collection("showtimes").insertOne(showtime);
  showtime._id = result.insertedId;
  res.status(201).json(showtime);
});

app.put("/api/showtimes/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!isObjectId(req.params.id)) return badId(res, "showtime");

  const db = getDb();
  const showtimeId = id(req.params.id);
  const current = await db.collection("showtimes").findOne({ _id: showtimeId });
  if (!current) return res.status(404).json({ message: "Showtime not found" });

  const movieId = req.body.movieId ? id(req.body.movieId) : current.movieId;
  const hallId = req.body.hallId ? id(req.body.hallId) : current.hallId;
  const date = req.body.date ?? current.date;
  const startTime = req.body.startTime ?? current.startTime;
  const price = req.body.price !== undefined ? req.body.price : current.price;

  if (!isObjectId(movieId) || !isObjectId(hallId)) {
    return res.status(400).json({ message: "Movie and hall ids must be valid." });
  }

  const inputProblem = validateShowtimeInput({ date, startTime, price });
  if (inputProblem) return res.status(400).json({ message: inputProblem });
  if (isShowtimePast(date, startTime)) {
    return res.status(400).json({ message: "Showtime must start in the future." });
  }

  const [movie, hall] = await Promise.all([
    db.collection("movies").findOne({ _id: movieId }),
    db.collection("halls").findOne({ _id: hallId })
  ]);
  if (!movie) return res.status(404).json({ message: "Movie not found" });
  if (!hall) return res.status(404).json({ message: "Hall not found" });
  if (hallStatus(hall) === HALL_STATUS.INACTIVE) {
    return res.status(409).json({ message: `"${hall.name}" is inactive and can't receive showtimes.`, code: "HALL_INACTIVE" });
  }

  const dateProblem = showtimeDateProblem(movie, date);
  if (dateProblem) return res.status(400).json({ message: dateProblem });

  const candidate = {
    movieId, hallId, date, startTime, duration: Number(movie.duration), title: movie.title
  };
  const conflict = await findShowtimeHallConflict(candidate, showtimeId);
  if (conflict) {
    return res.status(409).json({ message: conflictMessage(hall, conflict, 20), code: "SHOWTIME_CONFLICT" });
  }

  const update = { movieId, hallId, date, startTime, price: Number(price) };
  if (req.body.status !== undefined) update.status = String(req.body.status).toUpperCase();

  const result = await db.collection("showtimes").findOneAndUpdate(
    { _id: showtimeId }, { $set: update }, { returnDocument: "after" }
  );
  if (!result) return res.status(404).json({ message: "Showtime not found" });
  res.json(result);
});

app.delete("/api/showtimes/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!isObjectId(req.params.id)) return badId(res, "showtime");

  const db = getDb();
  const showtimeId = id(req.params.id);
  const showtime = await db.collection("showtimes").findOne({ _id: showtimeId });
  if (!showtime) return res.status(404).json({ message: "Showtime not found" });

  const bookingCount = await db.collection("bookings").countDocuments({ showtimeId });
  if (bookingCount > 0) {
    return res.status(409).json({
      message: "This showtime has bookings and can't be deleted.",
      code: "SHOWTIME_HAS_BOOKINGS",
      bookingCount
    });
  }

  await db.collection("showtimes").deleteOne({ _id: showtimeId });
  res.json({ message: "Showtime deleted" });
});

// ---------------- BOOKINGS ----------------
app.get("/api/bookings/my", requireAuth, async (req, res) => {
  const bookings = await getDb().collection("bookings").aggregate([
    { $match: { userId: id(req.user.id) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "showtimes",
        localField: "showtimeId",
        foreignField: "_id",
        as: "showtime"
      }
    },
    { $unwind: "$showtime" },
    {
      $lookup: {
        from: "movies",
        localField: "showtime.movieId",
        foreignField: "_id",
        as: "movie"
      }
    },
    { $unwind: "$movie" },
    {
      $lookup: {
        from: "halls",
        localField: "showtime.hallId",
        foreignField: "_id",
        as: "hall"
      }
    },
    { $unwind: "$hall" }
  ]).toArray();

  res.json(bookings);
});

app.get("/api/bookings", requireAuth, requireAdmin, async (_req, res) => {
  const bookings = await getDb().collection("bookings").aggregate([
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "showtimes",
        localField: "showtimeId",
        foreignField: "_id",
        as: "showtime"
      }
    },
    { $unwind: "$showtime" },
    {
      $lookup: {
        from: "movies",
        localField: "showtime.movieId",
        foreignField: "_id",
        as: "movie"
      }
    },
    { $unwind: "$movie" }
  ]).toArray();

  res.json(bookings);
});

// Admin: list registered users
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

// Create booking
app.post("/api/bookings", requireAuth, async (req, res) => {
  try {
    const { showtimeId, seats } = req.body;

    if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({
        message: "Showtime and at least one seat are required"
      });
    }

    const normalizedSeats = seats.map(seat => String(seat).trim().toUpperCase());
    if (normalizedSeats.some(seat => !seat)) {
      return res.status(400).json({ message: "Seat numbers cannot be empty." });
    }
    const uniqueSeats = [...new Set(normalizedSeats)];

    const showtime = await getDb()
      .collection("showtimes")
      .findOne({ _id: id(showtimeId) });

    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    // Booking rules: only movies inside their availability period can be booked.
    const movie = await getDb()
      .collection("movies")
      .findOne({ _id: showtime.movieId });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    const movieStatus = getMovieStatus(movie);

    if (movieStatus !== MOVIE_STATUS.NOW_SHOWING) {
      return res.status(409).json({
        message: bookingBlockedMessage(movie, movieStatus),
        code: `MOVIE_${movieStatus}`
      });
    }

    const hall = await getDb()
      .collection("halls")
      .findOne({ _id: showtime.hallId });

    if (!hall) {
      return res.status(404).json({ message: "Hall not found" });
    }

    if (hallStatus(hall) === HALL_STATUS.INACTIVE) {
      return res.status(409).json({
        message: `"${hall.name}" is inactive and this showtime can't be booked.`,
        code: "HALL_INACTIVE"
      });
    }

    if (isShowtimePast(showtime.date, showtime.startTime)) {
      return res.status(409).json({
        message: "This showtime has already started and can't be booked.",
        code: "SHOWTIME_STARTED"
      });
    }

    const availabilityProblem = showtimeDateProblem(movie, showtime.date);
    if (availabilityProblem) {
      return res.status(409).json({
        message: availabilityProblem,
        code: "SHOWTIME_OUTSIDE_MOVIE_AVAILABILITY"
      });
    }

    const validSeats = generateValidSeats(hall.rows, hall.seatsPerRow);


    if (uniqueSeats.some(seat => !validSeats.has(seat))) {
      return res.status(400).json({
        message: "One or more seats are invalid"
      });
    }

    const user = await getDb()
      .collection("users")
      .findOne({ _id: id(req.user.id) });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalAmount = uniqueSeats.length * Number(showtime.price);

    const booking = {
      bookingReference: generateReference(),
      userId: id(req.user.id),
      username: user.name,
      showtimeId: id(showtimeId), 
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

// Get booking by ID
app.get("/api/bookings/:id", requireAuth, async (req, res) => {
  const booking = await getDb().collection("bookings")
    .findOne({ _id: id(req.params.id) });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (
    req.user.role !== "admin" &&
    booking.userId.toString() !== req.user.id
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(booking);
});

// ---------------- UPDATE BOOKING SEATS ----------------
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

    const movie = await getDb().collection("movies").findOne({
      _id: showtime.movieId
    });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found." });
    }

    {
      const movieStatus = getMovieStatus(movie);

      if (movieStatus !== MOVIE_STATUS.NOW_SHOWING) {
        return res.status(409).json({
          message: bookingBlockedMessage(movie, movieStatus),
          code: `MOVIE_${movieStatus}`
        });
      }

      const availabilityProblem = showtimeDateProblem(movie, showtime.date);
      if (availabilityProblem) {
        return res.status(409).json({
          message: availabilityProblem,
          code: "SHOWTIME_OUTSIDE_MOVIE_AVAILABILITY"
        });
      }
    }

    if (isShowtimePast(showtime.date, showtime.startTime)) {
      return res.status(409).json({
        message: "This showtime has already started and can't be changed for booking.",
        code: "SHOWTIME_STARTED"
      });
    }

    const hall = await getDb().collection("halls").findOne({
      _id: showtime.hallId
    });

    if (!hall) {
      return res.status(404).json({ message: "Hall not found." });
    }

    if (hallStatus(hall) === HALL_STATUS.INACTIVE) {
      return res.status(409).json({
        message: `"${hall.name}" is inactive and this booking can't be changed.`,
        code: "HALL_INACTIVE"
      });
    }

    const validSeats = generateValidSeats(hall.rows, hall.seatsPerRow);


    if (uniqueSeats.some(seat => !validSeats.has(seat))) {
      return res.status(400).json({
        message: "One or more selected seats are invalid."
      });
    }

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

    // Notify other clients viewing the same showtime that the seats have changed.
    // This occurs when a customer releases a seat while editing a booking
    const oldSeats=booking.seats || [];

    const releasedSeats=oldSeats.filter(
      (seat)=> !uniqueSeats.includes(seat)
    );

    const bookedSeats =uniqueSeats.filter(
      (seat)=> !oldSeats.includes(seat)
    );
    
    broadcastToShowtime(String(booking.showtimeId), {
      type: "SEATS_UPDATED",
      showtimeId: String(booking.showtimeId),
      releasedSeats,
      bookedSeats
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

// ---------------- CANCEL BOOKING ----------------
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
      ws.send(JSON.stringify({
        type: "ERROR",
        message: "Invalid WebSocket message"
      }));
    }
  });

  ws.on("close", () => {
    if (ws.currentRoom && rooms.has(ws.currentRoom)) {
      rooms.get(ws.currentRoom).delete(ws);

      if (rooms.get(ws.currentRoom).size === 0) {
        rooms.delete(ws.currentRoom);
      }
    }
  });
});

export { app, server };