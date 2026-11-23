import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3001),
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017",
  dbName: process.env.DB_NAME || "cinema_booking",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5174",
  // Time zone used to decide what "today" is for movie availability.
  timeZone: process.env.CINEMA_TIMEZONE || "Asia/Kuala_Lumpur",
  // Ended movies are moved to Archived this many days after their end date.
  // Use -1 to disable automatic archiving (ended movies stay under "Previously Shown").
  movieAutoArchiveDays: Number(process.env.MOVIE_AUTO_ARCHIVE_DAYS ?? 30),
  showtimeCleaningMinutes: Number(process.env.SHOWTIME_CLEANING_MINUTES ?? 20)
};
