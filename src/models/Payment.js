const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  transactionId: { type: DataTypes.STRING, allowNull: false, unique: true },
  customer: { type: DataTypes.STRING, allowNull: false },
  service: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  method: { type: DataTypes.STRING, defaultValue: 'UPI / GPay' },
  status: { type: DataTypes.STRING, defaultValue: 'Success' },
  avatar: { type: DataTypes.TEXT, allowNull: true }
}, { timestamps: true });

const Refund = sequelize.define('Refund', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  refundId: { type: DataTypes.STRING, allowNull: false, unique: true },
  customer: { type: DataTypes.STRING, allowNull: false },
  service: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'Pending' },
  avatar: { type: DataTypes.TEXT, allowNull: true }
}, { timestamps: true });

module.exports = { Transaction, Refund };