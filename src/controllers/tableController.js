const sequelize = require('../config/database');

// Fetch all table names in the database
exports.getDatabaseTables = async (req, res) => {
  try {
    const [results] = await sequelize.query("SHOW TABLES;");
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};