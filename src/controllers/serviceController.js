const Service = require("../models/Service");
const { ValidationError, UniqueConstraintError } = require("sequelize");

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";

const DEFAULT_BENEFITS = [
  "Personalized consultation",
  "Professional tools & hygiene",
  "Finishing expert advice",
];

const MAX_IMAGE_LENGTH = 15 * 1024 * 1024; // 15MB limit

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseBenefits = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [...DEFAULT_BENEFITS];
};

const normalizeImage = (image, existingImage = null) => {
  if (image === undefined || image === null || image === "") {
    return existingImage || DEFAULT_IMAGE;
  }

  if (typeof image !== "string") {
    try {
      image = String(image);
    } catch {
      return existingImage || DEFAULT_IMAGE;
    }
  }

  const cleanImage = image.trim();

  if (!cleanImage) {
    return existingImage || DEFAULT_IMAGE;
  }

  if (cleanImage.length > MAX_IMAGE_LENGTH) {
    throw new Error(
      "Image is too large. Please choose an image smaller than 15MB."
    );
  }

  return cleanImage;
};

const getServiceId = (value) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const formatService = (service) => {
  const item =
    typeof service.toJSON === "function"
      ? service.toJSON()
      : { ...service };

  let imagePath = item.image || DEFAULT_IMAGE;
  if (imagePath && imagePath.startsWith("uploads/")) {
    imagePath = `/${imagePath}`;
  }

  return {
    ...item,
    id: String(item.id),
    price: Number(item.price),
    duration: item.duration || "60 mins",
    image: imagePath,
    description: item.description || "",
    benefits: parseBenefits(item.benefits),
    isTrending: toBoolean(item.isTrending, false),
    discountApplicable: toBoolean(item.discountApplicable, true),
  };
};

// --------------------------------------------------
// GET ALL SERVICES (Bulletproofed against 500 crashes)
// --------------------------------------------------

exports.getAllServices = async (req, res) => {
  try {
    // Ensure table exists or auto-sync gracefully if missing
    await Service.sync({ alter: false }).catch(() => {});

    const services = await Service.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services.map(formatService),
    });
  } catch (error) {
    console.error("[SERVICES] Fetching services failed:", error.message);

    // If table doesn't exist yet or connection is resetting, return a safe empty array 
    // instead of a 500 error so the frontend UI loads smoothly.
    if (error.original?.code === 'ER_NO_SUCH_TABLE' || error.name === 'SequelizeDatabaseError') {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "Services table is initializing. Please check back in a moment.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Fetching services failed.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// --------------------------------------------------
// GET SERVICE BY ID
// --------------------------------------------------

exports.getServiceById = async (req, res) => {
  try {
    const id = getServiceId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: formatService(service),
    });
  } catch (error) {
    console.error("[SERVICES] Fetching service by ID failed:", error.message);
    return res.status(500).json({ success: false, message: "Fetching service failed." });
  }
};

// --------------------------------------------------
// CREATE SERVICE
// --------------------------------------------------

exports.createService = async (req, res) => {
  try {
    const body = req.body || {};

    const name = String(body.name ?? body.title ?? "").trim();
    const category = String(body.category ?? "").trim();
    const price = Number(body.price);
    const duration = String(body.duration || "60 mins").trim();
    const description = String(body.description ?? body.desc ?? "").trim();

    if (!name || name.length < 2 || name.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Service name must contain 2 to 150 characters.",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Please select a service category.",
      });
    }

    if (
      body.price === undefined ||
      body.price === null ||
      body.price === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99999999.99
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid service price.",
      });
    }

    if (!duration || duration.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid service duration.",
      });
    }

    let imagePath = DEFAULT_IMAGE;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else if (body.imageUrl !== undefined && String(body.imageUrl).trim()) {
      imagePath = normalizeImage(body.imageUrl);
    } else if (body.image !== undefined && String(body.image).trim() && !String(body.image).startsWith("blob:")) {
      imagePath = normalizeImage(body.image);
    }

    const service = await Service.create({
      name,
      category,
      price,
      duration,
      description,
      image: imagePath,
      benefits: parseBenefits(body.benefits),
      isTrending: toBoolean(body.isTrending ?? body.is_trending, false),
      discountApplicable: toBoolean(
        body.discountApplicable ?? body.discount_applicable,
        true
      ),
    });

    const savedService = formatService(service);
    const io = req.app.get("io");

    if (io) {
      io.emit("serviceAdded", savedService);
    }

    return res.status(201).json({
      success: true,
      message: "Service created successfully.",
      data: savedService,
    });
  } catch (error) {
    console.error("[SERVICES] Creating service failed:", error.message);
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, message: error.errors?.[0]?.message || "Validation error." });
    }
    return res.status(500).json({ success: false, message: "Creating service failed." });
  }
};

// --------------------------------------------------
// UPDATE SERVICE
// --------------------------------------------------

exports.updateService = async (req, res) => {
  try {
    const id = getServiceId(req.params.id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid service ID." });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found." });
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined || body.title !== undefined) {
      const name = String(body.name ?? body.title ?? "").trim();
      if (name.length < 2 || name.length > 150) {
        return res.status(400).json({ success: false, message: "Service name must contain 2 to 150 characters." });
      }
      updates.name = name;
    }

    if (body.category !== undefined) {
      updates.category = String(body.category).trim();
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: "Enter a valid service price." });
      }
      updates.price = price;
    }

    if (body.duration !== undefined) {
      updates.duration = String(body.duration).trim();
    }

    if (body.description !== undefined || body.desc !== undefined) {
      updates.description = String(body.description ?? body.desc ?? "").trim();
    }

    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    } else if (body.imageUrl !== undefined && String(body.imageUrl).trim()) {
      updates.image = normalizeImage(body.imageUrl, service.image);
    }

    if (body.benefits !== undefined) {
      updates.benefits = parseBenefits(body.benefits);
    }

    if (body.isTrending !== undefined || body.is_trending !== undefined) {
      updates.isTrending = toBoolean(body.isTrending ?? body.is_trending, false);
    }

    if (body.discountApplicable !== undefined || body.discount_applicable !== undefined) {
      updates.discountApplicable = toBoolean(body.discountApplicable ?? body.discount_applicable, true);
    }

    await service.update(updates);
    await service.reload();

    const updatedService = formatService(service);
    const io = req.app.get("io");

    if (io) {
      io.emit("serviceUpdated", updatedService);
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      data: updatedService,
    });
  } catch (error) {
    console.error("[SERVICES] Updating service failed:", error.message);
    return res.status(500).json({ success: false, message: "Updating service failed." });
  }
};

// --------------------------------------------------
// DELETE SERVICE
// --------------------------------------------------

exports.deleteService = async (req, res) => {
  try {
    const id = getServiceId(req.params.id);

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid service ID." });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found." });
    }

    await service.destroy();
    const io = req.app.get("io");

    if (io) {
      io.emit("serviceDeleted", String(id));
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
      data: { id: String(id) },
    });
  } catch (error) {
    console.error("[SERVICES] Deleting service failed:", error.message);
    return res.status(500).json({ success: false, message: "Deleting service failed." });
  }
};