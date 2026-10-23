const path = require("path");

// Load .env only in local development.
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

// Configure allowed frontend URLs for CORS
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:5173,http://localhost:5174,http://localhost:5175,https://beautyvibee.vercel.app"
    : "https://beautyvibee.vercel.app")
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[BeautyVibe Socket] Connected: ${socket.id}`);

  socket.on("error", (err) => {
    console.error("[BeautyVibe Socket] Error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[BeautyVibe Socket] Disconnected: ${socket.id} (${reason})`);
  });
});

let shuttingDown = false;

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.error(`[BeautyVibe] Shutting down: ${reason}`);

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
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error("Missing required database environment variables");
  }

  await sequelize.authenticate();
  console.log(`[BeautyVibe DB] MySQL connected (${process.env.NODE_ENV === 'production' ? 'Aiven Cloud' : 'Localhost'})`);

  // BULLETPROOF FIX: Use plain sequelize.sync() in production to prevent ER_TOO_MANY_KEYS key bloat.
  // Only use light alter during local development if explicitly desired, or remove alter entirely.
  if (process.env.NODE_ENV !== "production") {
    await sequelize.sync(); 
    console.log("[BeautyVibe DB] Development models synchronized safely");
  } else {
    // In production (Render + Aiven), just authenticate connection without altering table structures
    await sequelize.sync(); 
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
  console.error("====================================");
  console.error("[BeautyVibe] CRITICAL STARTUP ERROR:");
  console.error(err);
  console.error("====================================");
  
  setTimeout(() => {
    process.exit(1);
  }, 2000);
});