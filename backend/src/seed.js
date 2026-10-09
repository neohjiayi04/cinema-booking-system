import { connectDb, getDb } from "./db.js";
import { hashPassword } from "./auth.js";

await connectDb();
const db = getDb();

await db.collection("users").deleteMany({});
await db.collection("movies").deleteMany({});
await db.collection("halls").deleteMany({});
await db.collection("showtimes").deleteMany({});
await db.collection("bookings").deleteMany({});

const admin = {
  name: "Cinema Admin",
  email: "admin@cinema.local",
  passwordHash: await hashPassword("Admin123!"),
  role: "admin",
  createdAt: new Date()
};

const customer = {
  name: "Demo Customer",
  email: "customer@cinema.local",
  passwordHash: await hashPassword("Customer123!"),
  role: "customer",
  createdAt: new Date()
};

await db.collection("users").insertMany([admin, customer]);

const halls = await db.collection("halls").insertMany([
  { name: "Hall 1", rows: 5, seatsPerRow: 8 },
  { name: "Hall 2", rows: 6, seatsPerRow: 10 },
  { name: "Hall 3", rows: 8, seatsPerRow: 10 }
]);

const movies = await db.collection("movies").insertMany([
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
]);

const movieIds = Object.values(movies.insertedIds);
const hallIds = Object.values(halls.insertedIds);

await db.collection("showtimes").insertMany([
  { movieId: movieIds[0], hallId: hallIds[0], date: "2026-10-10", startTime: "14:00", price: 18, status: "ACTIVE" },
  { movieId: movieIds[0], hallId: hallIds[1], date: "2026-10-10", startTime: "20:30", price: 22, status: "ACTIVE" },
  { movieId: movieIds[1], hallId: hallIds[2], date: "2026-10-11", startTime: "17:00", price: 20, status: "ACTIVE" },
  { movieId: movieIds[2], hallId: hallIds[0], date: "2026-10-11", startTime: "19:30", price: 18, status: "ACTIVE" }
]);

console.log("Seed completed.");
console.log("Admin: admin@cinema.local / Admin123!");
console.log("Customer: customer@cinema.local / Customer123!");

process.exit(0);
