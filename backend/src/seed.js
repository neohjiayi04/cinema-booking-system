import { connectDb, getDb } from "./db.js";
import { hashPassword } from "./auth.js";

await connectDb();
const db = getDb();

/**
 * Safe, repeatable demo-data seeder.
 * Existing records are preserved; this script only inserts missing demo records.
 * It intentionally does not delete bookings, users, movies, halls, or showtimes.
 */
async function ensureRecord(collectionName, filter, document) {
  const collection = db.collection(collectionName);
  await collection.updateOne(filter, { $setOnInsert: document }, { upsert: true });
  return collection.findOne(filter);
}

const passwordHash = await hashPassword("Admin123!");
await ensureRecord("users", { email: "admin@cinema.local" }, {
  name: "Cinema Admin",
  email: "admin@cinema.local",
  passwordHash,
  role: "admin",
  createdAt: new Date()
});

const customerPasswordHash = await hashPassword("Customer123!");
await ensureRecord("users", { email: "customer@cinema.local" }, {
  name: "Demo Customer",
  email: "customer@cinema.local",
  passwordHash: customerPasswordHash,
  role: "customer",
  createdAt: new Date()
});

const hallSeed = [
  { name: "Hall 1", rows: 5, seatsPerRow: 8 },
  { name: "Hall 2", rows: 6, seatsPerRow: 10 },
  { name: "Hall 3", rows: 8, seatsPerRow: 10 }
];

const halls = [];
for (const hall of hallSeed) {
  halls.push(await ensureRecord("halls", { name: hall.name }, hall));
}

const movieSeed = [
  {
    title: "Neon Horizon",
    description: "A science-fiction adventure beyond the edge of the known world.",
    genre: "Sci-Fi",
    duration: 128,
    rating: "PG-13",
    poster: "https://placehold.co/400x600?text=Neon+Horizon",
    releaseDate: "2026-10-01",
    status: "NOW_SHOWING"
  },
  {
    title: "The Last Signal",
    description: "A suspense thriller about a mysterious transmission.",
    genre: "Thriller",
    duration: 112,
    rating: "PG-13",
    poster: "https://placehold.co/400x600?text=The+Last+Signal",
    releaseDate: "2026-09-25",
    status: "NOW_SHOWING"
  },
  {
    title: "Moonlight Avenue",
    description: "A warm romantic drama set in a city that never sleeps.",
    genre: "Drama",
    duration: 105,
    rating: "PG",
    poster: "https://placehold.co/400x600?text=Moonlight+Avenue",
    releaseDate: "2026-09-18",
    status: "NOW_SHOWING"
  }
];

const movies = [];
for (const movie of movieSeed) {
  movies.push(await ensureRecord("movies", { title: movie.title }, movie));
}

const showtimeSeed = [
  { movieTitle: "Neon Horizon", hallName: "Hall 1", date: "2026-10-10", startTime: "14:00", price: 18, status: "ACTIVE" },
  { movieTitle: "Neon Horizon", hallName: "Hall 2", date: "2026-10-10", startTime: "20:30", price: 22, status: "ACTIVE" },
  { movieTitle: "The Last Signal", hallName: "Hall 3", date: "2026-10-11", startTime: "17:00", price: 20, status: "ACTIVE" },
  { movieTitle: "Moonlight Avenue", hallName: "Hall 1", date: "2026-10-11", startTime: "19:30", price: 18, status: "ACTIVE" }
];

for (const showtime of showtimeSeed) {
  const movie = movies.find((item) => item.title === showtime.movieTitle);
  const hall = halls.find((item) => item.name === showtime.hallName);
  await ensureRecord(
    "showtimes",
    {
      movieId: movie._id,
      hallId: hall._id,
      date: showtime.date,
      startTime: showtime.startTime
    },
    {
      movieId: movie._id,
      hallId: hall._id,
      date: showtime.date,
      startTime: showtime.startTime,
      price: showtime.price,
      status: showtime.status,
      createdAt: new Date()
    }
  );
}

console.log("Demo seed completed. Existing records were preserved.");
console.log("Admin demo login: admin@cinema.local / Admin123!");
console.log("Customer demo login: customer@cinema.local / Customer123!");
process.exit(0);
