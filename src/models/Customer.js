// src/models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    defaultValue: '+91 98765 43210',
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bookings: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  spent: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Active', // 'Active', 'VIP Member', 'Blocked'
  },
  authProvider: {
    type: DataTypes.STRING,
    defaultValue: 'local', // 'local' or 'google'
  }
}, {
  timestamps: true,
});

module.exports = User;