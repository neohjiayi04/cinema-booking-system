import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017",
  dbName: process.env.DB_NAME || "cinema_booking",
  jwtSecret: process.env.JWT_SECRET || "development-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
};
