const path = require("path");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({
    path: path.join(__dirname, "../.env")
  });
}

const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = require("./app");
const sequelize = require("./config/database");

// Register models and their associations
require("./models/User");
require("./models/Service");
require("./models/Appointment");
require("./models/Package");
require("./models/Staff");
require("./models/Offer");
require("./models/Payment");
require("./models/Address");

const PORT = Number(process.env.PORT || 5000);
const server = http.createServer(app);

// Robust allowed origins supporting production and previews
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://beautyvibee.vercel.app",
  "https://beautyvibe-admin.vercel.app",
  "https://beautyvibes.in",
  "https://www.beautyvibes.in",
];

// Helper to check if an origin is permitted (supports exact matches & Vercel subdomains)
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = origin.replace(/\/+$/, "");
  const isVercelSubdomain = /\.vercel\.app$/i.test(cleanOrigin);
  const isExplicitlyAllowed = allowedOrigins.includes(cleanOrigin);
  return isExplicitlyAllowed || isVercelSubdomain;
};

// Configure Express CORS middleware globally to prevent API CORS blocks
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[Express CORS Blocked] Unrecognized origin: "${origin}"`);
        callback(new Error("Origin not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);

// Share allowedOrigins with Express app if needed
app.set("allowedOrigins", allowedOrigins);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      console.warn(`[Socket.io CORS Blocked] Unrecognized origin: "${origin}"`);
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    credentials: true,
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

  // Safely synchronize models and schema columns without dropping tables
  await sequelize.sync({ alter: true });  
  console.log("[BeautyVibe DB] Models and schema synchronized successfully");

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