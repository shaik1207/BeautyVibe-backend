
const path = require("path");

// Local development only needs .env.
// Railway supplies production environment variables itself.
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({
    path: path.join(__dirname, "../.env")
  });
}

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const sequelize = require("./config/database");

// Register models and their associations.
require("./models/User");
require("./models/Service");
require("./models/Appointment");
require("./models/Package");
require("./models/Staff");
require("./models/Offer");
require("./models/Payment");

const PORT = Number(process.env.PORT || 5000);
const server = http.createServer(app);

// Configure FRONTEND_URLS as comma-separated production URLs.
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    : "")
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key"
    ]
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[BeautyVibe Socket] Connected: ${socket.id}`);

  socket.on("error", (err) => {
    console.error("[BeautyVibe Socket] Error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[BeautyVibe Socket] Disconnected: ${socket.id} (${reason})`
    );
  });
});

let shuttingDown = false;

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.error(`[BeautyVibe] Shutting down: ${reason}`);

  // Allow existing HTTP connections to close.
  const forceExit = setTimeout(() => {
    console.error("[BeautyVibe] Shutdown timed out");
    process.exit(1);
  }, 10000);

  forceExit.unref();

  io.close(async () => {
    try {
      await sequelize.close();
      console.log("[BeautyVibe] Database connection closed");
    } catch (err) {
      console.error("[BeautyVibe] Database shutdown error:", err.message);
      exitCode = 1;
    }

    clearTimeout(forceExit);
    process.exit(exitCode);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[BeautyVibe] Unhandled rejection:", reason);
  shutdown("Unhandled promise rejection", 1);
});

process.on("uncaughtException", (err) => {
  console.error("[BeautyVibe] Uncaught exception:", err);
  shutdown("Uncaught exception", 1);
});

async function startServer() {
  if (!process.env.DB_HOST ||
      !process.env.DB_NAME ||
      !process.env.DB_USER) {
    throw new Error("Missing required database environment variables");
  }

  await sequelize.authenticate();

  console.log("[BeautyVibe DB] MySQL connected");

  // Do not run sync({ alter: true }) in production.
  // Apply reviewed Sequelize migrations before starting this service.
  if (process.env.NODE_ENV !== "production") {
    await sequelize.sync({ alter: true });
    console.log("[BeautyVibe DB] Development models synchronized");
  }

  await new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(PORT, "0.0.0.0", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  console.log(`[BeautyVibe Server] Listening on port ${PORT}`);
}

startServer().catch((err) => {
  console.error("[BeautyVibe] Startup failed:", err);
  process.exit(1);
});
