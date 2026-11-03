const express = require('express');
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { 
  getPackages, 
  createPackage, 
  updatePackage, 
  deletePackage 
} = require('../controllers/packageController');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// Ensure absolute path for uploads directory
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed!"), false);
    }
  },
});

// Routes with Multer middleware for image uploads
router.route('/')
  .get(getPackages)
  .post(protect, adminOnly, upload.single("image"), createPackage);

router.route('/:id')
  .put(protect, adminOnly, upload.single("image"), updatePackage)
  .delete(protect, adminOnly, deletePackage);

module.exports = router;