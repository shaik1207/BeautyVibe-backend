const Service = require('../models/Service');
const { Op } = require('sequelize');

// 1. Get all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll({ order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error("Fetch Services Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get single service by ID or Name
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    let service = null;

    if (!isNaN(id)) {
      service = await Service.findByPk(id);
    }

    if (!service) {
      service = await Service.findOne({
        where: {
          [Op.or]: [
            { name: { [Op.like]: `%${id}%` } },
            { category: { [Op.like]: `%${id}%` } }
          ]
        }
      });
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error("Get Service By ID Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Create a new service (FIXES THE 404 ERROR)
exports.createService = async (req, res) => {
  try {
    const { name, category, price, duration, image, description, benefits, type } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Service name and price are required.' });
    }

    // Safely parse benefits array for MySQL storage
    let safeBenefits = JSON.stringify(["Premium consultation", "Expert care"]);
    if (benefits) {
      safeBenefits = Array.isArray(benefits) ? JSON.stringify(benefits) : JSON.stringify([benefits]);
    }

    const newService = await Service.create({
      name,
      category: category || 'General',
      price: Number(price),
      duration: duration || '45 mins',
      image: image || 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80',
      description: description || 'Premium BeautyVibe service.',
      benefits: safeBenefits,
      type: type || 'SALON',
      rating: '5.0',
      reviews: '0'
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Service saved to database successfully.', 
      data: newService 
    });
  } catch (error) {
    console.error("Create Service Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};