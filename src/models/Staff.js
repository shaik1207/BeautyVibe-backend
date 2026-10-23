const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Staff = sequelize.define('Staff', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  phone: { type: DataTypes.STRING, allowNull: false },
  dob: { type: DataTypes.DATEONLY, allowNull: true },
  gender: { type: DataTypes.STRING, defaultValue: 'Female' },
  role: { type: DataTypes.STRING, defaultValue: 'Senior Aesthetician' },
  workExperience: { type: DataTypes.STRING, defaultValue: '2 Years' },
  proofOfSubmission: { type: DataTypes.STRING, defaultValue: 'Verified' },
  permanentAddress: { type: DataTypes.TEXT, allowNull: true },
  avatar: { type: DataTypes.TEXT, allowNull: true },
  rating: { type: DataTypes.DECIMAL(3, 1), defaultValue: 5.0 },
  status: { type: DataTypes.STRING, defaultValue: 'Available' }
}, { timestamps: true });

module.exports = Staff;