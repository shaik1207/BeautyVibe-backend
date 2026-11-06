const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = require("./User");
const Service = require("./Service");

const Appointment = sequelize.define(
  "Appointment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    customerName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: "Valued Client",
    },

    mobileNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "",
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },

    serviceName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "General",
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "SALON",
    },

    date: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    time: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Pending",
    },

    assignedStaff: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: "",
    },

    requestId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    passCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    tableName: "appointments",
    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["requestId"],
        name: "appointments_request_id_unique",
      },
      {
        fields: ["userId"],
        name: "appointments_user_id_index",
      },
      {
        fields: ["serviceId"],
        name: "appointments_service_id_index",
      },
      {
        fields: ["date", "status"],
        name: "appointments_date_status_index",
      },
    ],
  }
);

// ============================================
// LOOSE ASSOCIATIONS
// ============================================

Appointment.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
  constraints: false,
});

User.hasMany(Appointment, {
  foreignKey: "userId",
  as: "appointments",
  constraints: false,
});

Appointment.belongsTo(Service, {
  foreignKey: "serviceId",
  as: "service",
  constraints: false,
});

Service.hasMany(Appointment, {
  foreignKey: "appointments",
  foreignKey: "serviceId",
  as: "appointments",
  constraints: false,
});

module.exports = Appointment;