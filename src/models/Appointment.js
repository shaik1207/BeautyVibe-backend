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
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "",
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "",
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
    phone: {
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
      defaultValue: "Beauty Ritual",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "General",
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
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
      defaultValue: "",
    },
    time: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "",
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
      defaultValue: "",
    },
  },
  {
    tableName: "appointments",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["serviceId"] },
      { fields: ["date"] },
      { fields: ["status"] },
    ],
    hooks: {
      beforeValidate: (appointment) => {
        if (typeof appointment.firstName === "string") {
          appointment.firstName = appointment.firstName.trim();
        }
        if (typeof appointment.lastName === "string") {
          appointment.lastName = appointment.lastName.trim();
        }

        const combinedName = [appointment.firstName, appointment.lastName].filter(Boolean).join(" ");
        if (combinedName) {
          appointment.customerName = combinedName;
        } else if (typeof appointment.customerName === "string") {
          const cleanName = appointment.customerName.trim();
          if (cleanName && !cleanName.includes("@")) {
            appointment.customerName = cleanName;
          } else {
            appointment.customerName = "Valued Client";
          }
        }

        if (typeof appointment.mobileNumber === "string") {
          appointment.mobileNumber = appointment.mobileNumber.trim();
        }
        if (typeof appointment.phone === "string") {
          appointment.phone = appointment.phone.trim();
        }

        if (!appointment.mobileNumber && appointment.phone) {
          appointment.mobileNumber = appointment.phone;
        }
        if (!appointment.phone && appointment.mobileNumber) {
          appointment.phone = appointment.mobileNumber;
        }
      },
    },
  }
);

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
  foreignKey: "serviceId",
  as: "appointments",
  constraints: false,
});

module.exports = Appointment;