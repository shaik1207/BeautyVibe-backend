const Package = require('../models/Package');

// Get all packages
exports.getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: packages });
  } catch (error) {
    console.error("Get Packages Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new package
exports.createPackage = async (req, res) => {
  try {
    const { name, tagline, price, originalPrice, duration, image, badge, isFeatured, services } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required.' });
    }

    const newPackage = await Package.create({
      name,
      tagline,
      price,
      originalPrice,
      duration,
      image,
      badge,
      isFeatured,
      services
    });

    // Emit real-time event via socket.io if initialized
    const io = req.app.get('io');
    if (io) {
      io.emit('packageAdded', newPackage);
    }

    res.status(201).json({ success: true, data: newPackage });
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

    await pkg.update(req.body);

    const io = req.app.get('io');
    if (io) {
      io.emit('packageUpdated', pkg);
    }

    res.status(200).json({ success: true, data: pkg });
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