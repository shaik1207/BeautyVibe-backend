const Package = require('../models/Package');

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=85";

const parseServices = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const formatPackage = (pkg) => {
  const item = typeof pkg.toJSON === "function" ? pkg.toJSON() : { ...pkg };
  let imagePath = item.image || DEFAULT_IMAGE;
  if (imagePath && imagePath.startsWith("uploads/")) {
    imagePath = `/${imagePath}`;
  }
  return {
    ...item,
    id: String(item.id),
    price: Number(item.price),
    originalPrice: item.originalPrice !== null && item.originalPrice !== undefined ? Number(item.originalPrice) : null,
    services: parseServices(item.services),
    image: imagePath,
    isFeatured: toBoolean(item.isFeatured, true),
  };
};

// Get all packages
exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: packages.map(formatPackage) });
  } catch (error) {
    console.error("Get Packages Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new package
exports.createPackage = async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name ?? "").trim();
    const price = Number(body.price);
    
    if (!name || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, message: 'Valid name and price are required.' });
    }

    let imagePath = DEFAULT_IMAGE;
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else if (body.imageUrl && String(body.imageUrl).trim()) {
      imagePath = String(body.imageUrl).trim();
    } else if (body.image && String(body.image).trim() && !String(body.image).startsWith("blob:")) {
      imagePath = String(body.image).trim();
    }

    const newPackage = await Package.create({
      name,
      tagline: String(body.tagline ?? "").trim(),
      price,
      originalPrice: body.originalPrice ? Number(body.originalPrice) : null,
      duration: String(body.duration ?? "60 mins").trim(),
      image: imagePath,
      badge: String(body.badge ?? "Signature Collection").trim(),
      isFeatured: toBoolean(body.isFeatured, true),
      services: parseServices(body.services)
    });

    const formatted = formatPackage(newPackage);
    const io = req.app.get('io');
    if (io) {
      io.emit('packageAdded', formatted);
    }

    res.status(201).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Create Package Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update an existing package
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findByPk(id);

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found.' });
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.tagline !== undefined) updates.tagline = String(body.tagline).trim();
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.originalPrice !== undefined) updates.originalPrice = body.originalPrice ? Number(body.originalPrice) : null;
    if (body.duration !== undefined) updates.duration = String(body.duration).trim();
    if (body.badge !== undefined) updates.badge = String(body.badge).trim();
    if (body.isFeatured !== undefined) updates.isFeatured = toBoolean(body.isFeatured, true);
    if (body.services !== undefined) updates.services = parseServices(body.services);

    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    } else if (body.imageUrl !== undefined && String(body.imageUrl).trim()) {
      let url = String(body.imageUrl).trim();
      if (url.startsWith("http://localhost:5000")) {
        url = url.replace("http://localhost:5000", "");
      }
      updates.image = url;
    } else if (body.image !== undefined && String(body.image).trim() && !String(body.image).startsWith("blob:")) {
      updates.image = String(body.image).trim();
    }

    await pkg.update(updates);
    await pkg.reload();

    const formatted = formatPackage(pkg);
    const io = req.app.get('io');
    if (io) {
      io.emit('packageUpdated', formatted);
    }

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Update Package Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a package
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findByPk(id);

    if (!pkg) {
      return res.status(404).json({ success: false, message: 'Package not found.' });
    }

    await pkg.destroy();

    const io = req.app.get('io');
    if (io) {
      io.emit('packageDeleted', id);
    }

    res.status(200).json({ success: true, message: 'Package deleted successfully.' });
  } catch (error) {
    console.error("Delete Package Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};