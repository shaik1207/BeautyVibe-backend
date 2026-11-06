
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = require("./User");
const Service = require("./Service");

// ============================================
// APPOINTMENT MODEL
// ============================================

const Appointment = sequelize.define(
  "Appointment",
  {
    // ----------------------------------------
    // PRIMARY KEY
    // ----------------------------------------

    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ----------------------------------------
    // USER & SERVICE REFERENCES
    // ----------------------------------------

    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // ----------------------------------------
    // CUSTOMER INFORMATION
    // ----------------------------------------

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

    // Kept for compatibility with existing frontend
    // and backend components using the phone field.
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "",
    },

    // Full doorstep / home-service address
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },

    // ----------------------------------------
    // SERVICE INFORMATION
    // ----------------------------------------

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

    // HOME or SALON
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "SALON",
    },

    // ----------------------------------------
    // APPOINTMENT SCHEDULE
    // ----------------------------------------

    date: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    time: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    // ----------------------------------------
    // APPOINTMENT STATUS
    // ----------------------------------------

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Pending",
    },

    // ----------------------------------------
    // STAFF INFORMATION
    // ----------------------------------------

    assignedStaff: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: "",
    },

    // ----------------------------------------
    // BOOKING IDENTIFIERS
    // ----------------------------------------

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
    // ----------------------------------------
    // TABLE CONFIGURATION
    // ----------------------------------------

    tableName: "appointments",

    timestamps: true,

    indexes: [
      {
        fields: ["userId"],
      },
      {
        fields: ["serviceId"],
      },
      {
        fields: ["date"],
      },
      {
        fields: ["status"],
      },
    ],

    // ----------------------------------------
    // DATA NORMALIZATION
    // ----------------------------------------

    hooks: {
      beforeValidate: (appointment) => {
        // Normalize customer name
        if (typeof appointment.customerName === "string") {
          appointment.customerName =
            appointment.customerName.trim() || "Valued Client";
        }

        // Normalize mobile number
        if (typeof appointment.mobileNumber === "string") {
          appointment.mobileNumber =
            appointment.mobileNumber.trim();
        }

        // Normalize phone number
        if (typeof appointment.phone === "string") {
          appointment.phone = appointment.phone.trim();
        }

        // Normalize address
        if (typeof appointment.address === "string") {
          appointment.address = appointment.address.trim();
        }

        // Keep phone and mobileNumber compatible
        if (!appointment.mobileNumber && appointment.phone) {
          appointment.mobileNumber = appointment.phone;
        }

        if (!appointment.phone && appointment.mobileNumber) {
          appointment.phone = appointment.mobileNumber;
        }

        // Normalize service name
        if (typeof appointment.serviceName === "string") {
          appointment.serviceName =
            appointment.serviceName.trim();
        }

        // Normalize category
        if (typeof appointment.category === "string") {
          appointment.category =
            appointment.category.trim() || "General";
        }

        // Normalize appointment type
        if (typeof appointment.type === "string") {
          appointment.type =
            appointment.type.trim().toUpperCase();
        }

        // Normalize status
        if (typeof appointment.status === "string") {
          appointment.status =
            appointment.status.trim();
        }
      },
    },
  }
);

// ============================================
// USER ASSOCIATION
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

// ============================================
// SERVICE ASSOCIATION
// ============================================

Appointment.belongsTo(Service, {
  foreignKey: "serviceId",
  as: "service",
  constraints: false,
});

Service.hasMany(Appointment, {
  foreignKey: "serviceId",
  as: "appointments",
  constraints: false,
});

// ============================================
// EXPORT MODEL
// ============================================

module.exports = Appointment;
