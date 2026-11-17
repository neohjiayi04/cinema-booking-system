import { MongoClient } from "mongodb";
import { config } from "./config.js";
import { normalizeTitle, releaseYear } from "./utils/movieUtils.js";

let client;
let db;

export async function connectDb() {
  client = new MongoClient(config.mongoUri);
  await client.connect();

  db = client.db(config.dbName);

  // Create the users collection if it does not exist.
  if (!(await db.listCollections({ name: "users" }).hasNext())) {
    await db.createCollection("users");
  }

  await db.collection("users").createIndex(
    { email: 1 },
    { unique: true }
  );

  // Create the bookings collection if it does not exist.
  if (!(await db.listCollections({ name: "bookings" }).hasNext())) {
    await db.createCollection("bookings");
  }

  const bookings = db.collection("bookings");

  // Remove the previous index if it exists.
  try {
    await bookings.dropIndex("showtimeId_1_seats_1");
  } catch (error) {
    if (error?.codeName !== "IndexNotFound" && error?.code !== 27) {
      throw error;
    }
  }

  // A seat is unique only while its booking is CONFIRMED.
  // CANCELLED bookings retain their history but release their seats.
  await bookings.createIndex(
    { showtimeId: 1, seats: 1 },
    {
      unique: true,
      partialFilterExpression: { status: "CONFIRMED" }
    }
  );

  await prepareMovies(db);

  console.log(`MongoDB connected: ${config.dbName}`);

  return db;
}

// Adds duplicate-check fields to older movie records.
async function prepareMovies(database) {
  const movies = database.collection("movies");

  const legacy = await movies.find({
    titleKey: { $exists: false }
  }).toArray();

  if (legacy.length) {
    await movies.bulkWrite(
      legacy.map(movie => ({
        updateOne: {
          filter: { _id: movie._id },
          update: {
            $set: {
              titleKey: normalizeTitle(movie.title),
              releaseYear: releaseYear(movie),
              archived: movie.archived === true
            }
          }
        }
      }))
    );
  }

  try {
    await movies.createIndex(
      { titleKey: 1, releaseYear: 1 },
      {
        unique: true,
        partialFilterExpression: {
          titleKey: { $type: "string" }
        }
      }
    );
  } catch (error) {
    console.warn(
      "Could not create the unique movie index (duplicate movies already exist?):",
      error.message
    );
  }
}

export function getDb() {
  if (!db) {
    throw new Error("Database not connected");
  }

  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}