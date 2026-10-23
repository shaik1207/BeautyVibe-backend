const Staff = require('../models/Staff');

// Get all staff members
exports.getStaff = async (req, res) => {
  try {
    const staffList = await Staff.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    console.error("Get Staff Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new staff member
exports.createStaff = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      dob, 
      gender, 
      role, 
      workExperience, 
      proofOfSubmission, 
      permanentAddress, 
      avatar 
    } = req.body;

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Required fields are missing.' });
    }

    const newStaff = await Staff.create({
      firstName,
      lastName,
      email,
      phone,
      dob: dob || null,
      gender,
      role,
      workExperience,
      proofOfSubmission,
      permanentAddress,
      avatar: avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80"
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('staffUpdated', newStaff);
    }

    res.status(201).json({ success: true, data: newStaff });
  } catch (error) {
    console.error("Create Staff Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a staff member
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staffMember = await Staff.findByPk(id);

    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    await staffMember.destroy();

    const io = req.app.get('io');
    if (io) {
      io.emit('staffDeleted', id);
    }

    res.status(200).json({ success: true, message: 'Staff member deleted successfully.' });
  } catch (error) {
    console.error("Delete Staff Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};