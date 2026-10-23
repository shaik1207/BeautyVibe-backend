const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Package = sequelize.define('Package', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tagline: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  duration: {
    type: DataTypes.STRING,
    defaultValue: '60 mins',
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  badge: {
    type: DataTypes.STRING,
    defaultValue: 'Signature Collection',
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  services: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('services');
      try { return JSON.parse(raw); } catch (e) { return []; }
    },
    set(value) {
      this.setDataValue('services', JSON.stringify(value));
    }
  }
}, {
  timestamps: true,
});

module.exports = Package;