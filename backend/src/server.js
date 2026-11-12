import { connectDb } from "./db.js";
import { config } from "./config.js";
import { server } from "./app.js";

try {
  await connectDb();

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`Cinema backend running on port ${config.port}`);
  });
} catch (error) {
  console.error("Failed to start cinema backend:", error);
  process.exit(1);
}