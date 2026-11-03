const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const serviceUploadDir =
  process.env.SERVICE_UPLOAD_DIR ||
  path.join(__dirname, "../uploads/services");

fs.mkdirSync(serviceUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, serviceUploadDir);
  },

  filename: (req, file, cb) => {
    const extensions = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };

    const extension = extensions[file.mimetype];

    if (!extension) {
      return cb(new Error("Unsupported image format."));
    }

    cb(null, `service-${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPG, PNG, WebP and GIF images are allowed.")
    );
  }

  cb(null, true);
};

const uploadServiceImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = {
  uploadServiceImage,
  serviceUploadDir,
};