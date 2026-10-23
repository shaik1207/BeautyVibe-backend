const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Offer = sequelize.define('Offer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  discount: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'Percentage' },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: false },
  expiry: { type: DataTypes.STRING, allowNull: true },
  usage: { type: DataTypes.STRING, defaultValue: '0 redemptions' },
  status: { type: DataTypes.STRING, defaultValue: 'Active' }
}, { timestamps: true });

module.exports = Offer;