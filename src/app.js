const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Import core routes
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const tableRoutes = require("./routes/tableRoutes");

// Import dashboard routes
const customerRoutes = require("./routes/customerRoutes");
const packageRoutes = require("./routes/packageRoutes");
const staffRoutes = require("./routes/staffRoutes");
const offerRoutes = require("./routes/offerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

// --------------------------------------------------
// CORS (Smart matcher supporting all Vercel previews & production domains)
// --------------------------------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://beautyvibee.vercel.app",
  "https://beautyvibe-admin.vercel.app",
  "https://beautyvibes.in",
  "https://www.beautyvibes.in", // Explicitly whitelisted to prevent www 403 blocks
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, mobile apps, server-to-server)
    if (!origin) return callback(null, true);

    // Clean trailing slash from incoming origin if any
    const cleanOrigin = origin.replace(/\/+$/, "");

    // Check if it's explicitly allowed OR is any Vercel deployment (*.vercel.app)
    const isVercelSubdomain = /\.vercel\.app$/i.test(cleanOrigin);
    const isExplicitlyAllowed = allowedOrigins.includes(cleanOrigin);

    if (isExplicitlyAllowed || isVercelSubdomain) {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Unrecognized origin attempted access: "${origin}"`);
    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
};

// Apply CORS globally (automatically handles preflight OPTIONS requests without crashing path-to-regexp)
app.use(cors(corsOptions));

// --------------------------------------------------
// BODY PARSING (Increased limit to 15mb for large payloads/images)
// --------------------------------------------------
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// --------------------------------------------------
// STATIC UPLOADED IMAGES (Must be declared before routes)
// --------------------------------------------------
const uploadDirectory =
  process.env.SERVICE_UPLOAD_DIR ||
  path.join(__dirname, "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(
  "/uploads",
  express.static(uploadDirectory, {
    maxAge: "7d",
    etag: true,
  })
);

// --------------------------------------------------
// CORE ROUTES
// --------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/tables", tableRoutes);

// --------------------------------------------------
// DASHBOARD ROUTES
// --------------------------------------------------
app.use("/api/customers", customerRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BeautyVibe API Running.",
  });
});

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found.",
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack || err.message);

  if (err instanceof require("multer").MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Image must be 15 MB or smaller."
        : err.message;

    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (
    err.message === "Origin not allowed by CORS" ||
    err.message?.includes("Only image files")
  ) {
    return res.status(
      err.message === "Origin not allowed by CORS" ? 403 : 400
    ).json({
      success: false,
      message: err.message,
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error.",
  });
});

module.exports = app;