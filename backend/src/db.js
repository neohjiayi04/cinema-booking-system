import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client;
let db;

export async function connectDb() {
  client = new MongoClient(config.mongoUri);
  await client.connect();
  db = client.db(config.dbName);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("bookings").createIndex(
    { showtimeId: 1, seats: 1 },
    { unique: true }
  );

  console.log(`MongoDB connected: ${config.dbName}`);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not connected");
  return db;
}
