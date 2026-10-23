const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');
const Service = require('./Service');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  serviceId: {
    type: DataTypes.INTEGER,
    allowNull: true, // REQUIRED: Must be true for SET NULL foreign keys
  },
  serviceName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'General',
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'SALON',
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Pending',
    allowNull: false,
  },
  assignedStaff: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  requestId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passCode: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'appointments',
  timestamps: true,
});

// Associations
Appointment.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
User.hasMany(Appointment, { foreignKey: 'userId', as: 'appointments' });

Appointment.belongsTo(Service, { foreignKey: 'serviceId', as: 'service', onDelete: 'SET NULL' });
Service.hasMany(Appointment, { foreignKey: 'serviceId', as: 'appointments' });

module.exports = Appointment;