
const express = require("express");
const router = express.Router();

const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");

const { protect } = require("../middleware/authMiddleware");

// GET /api/services
// Fetch all services
router.get("/", getAllServices);

// GET /api/services/:id
// Fetch one service
router.get("/:id", getServiceById);

// POST /api/services
// Create a service (authenticated)
router.post("/", protect, createService);

// PUT /api/services/:id
// Update an existing service (authenticated)
router.put("/:id", protect, updateService);

// DELETE /api/services/:id
// Delete an existing service (authenticated)
router.delete("/:id", protect, deleteService);

module.exports = router;
