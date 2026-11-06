const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");

// ============================================
// USER MODEL
// ============================================

const User = sequelize.define(
  "User",
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
    // PERSONAL INFORMATION
    // ----------------------------------------

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Customer name is required.",
        },
      },
    },

    // ----------------------------------------
    // CONTACT INFORMATION
    // ----------------------------------------

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,

      set(value) {
        this.setDataValue(
          "email",
          typeof value === "string"
            ? value.trim().toLowerCase()
            : value
        );
      },

      validate: {
        notEmpty: {
          msg: "Email address is required.",
        },
        isEmail: {
          msg: "Please provide a valid email address.",
        },
      },
    },

    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,

      set(value) {
        const normalized =
          value === undefined || value === null
            ? null
            : String(value).trim();

        this.setDataValue("phone", normalized || null);
        // Sync secondary fields automatically to prevent schema mismatches
        this.setDataValue("mobile", normalized || null);
        this.setDataValue("mobileNumber", normalized || null);
      },
    },

    mobile: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,

      set(value) {
        const normalized =
          value === undefined || value === null
            ? null
            : String(value).trim();

        this.setDataValue("mobile", normalized || null);
        this.setDataValue("phone", normalized || null);
        this.setDataValue("mobileNumber", normalized || null);
      },
    },

    mobileNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,

      set(value) {
        const normalized =
          value === undefined || value === null
            ? null
            : String(value).trim();

        this.setDataValue("mobileNumber", normalized || null);
        this.setDataValue("phone", normalized || null);
        this.setDataValue("mobile", normalized || null);
      },
    },

    // ----------------------------------------
    // AUTHENTICATION
    // ----------------------------------------

    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      // Nullable for Firebase / Google users.
    },

    role: {
      type: DataTypes.ENUM("user", "admin"),
      allowNull: false,
      defaultValue: "user",
    },

    authProvider: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "local",
      validate: {
        isIn: {
          args: [["local", "google"]],
          msg: "Invalid authentication provider.",
        },
      },
    },

    firebaseUid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },

    // ----------------------------------------
    // PROFILE INFORMATION
    // ----------------------------------------

    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ----------------------------------------
    // CUSTOMER STATISTICS
    // ----------------------------------------

    bookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },

    spent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0,
      },
    },

    // ----------------------------------------
    // ACCOUNT STATUS
    // ----------------------------------------

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Active",
    },

    // ----------------------------------------
    // CUSTOMER ADDRESSES
    // ----------------------------------------

    addresses: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    // ----------------------------------------
    // PAYMENT HISTORY
    // ----------------------------------------

    payments: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },

  {
    // ========================================
    // TABLE CONFIGURATION
    // ========================================

    tableName: "users",

    timestamps: true,

    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["firebaseUid"],
      },
      {
        fields: ["phone"],
      },
      {
        fields: ["mobile"],
      },
      {
        fields: ["role"],
      },
    ],

    // ========================================
    // MODEL HOOKS
    // ========================================

    hooks: {
      beforeValidate: (user) => {
        // Normalize first name
        if (typeof user.firstName === "string") {
          user.firstName = user.firstName.trim();
        }

        // Normalize last name
        if (typeof user.lastName === "string") {
          user.lastName = user.lastName.trim();
        }

        // Automatically construct full name
        const firstName = user.firstName || "";
        const lastName = user.lastName || "";

        const combinedName = `${firstName} ${lastName}`.trim();

        if (combinedName) {
          user.name = combinedName;
        } else if (typeof user.name === "string") {
          user.name = user.name.trim();
        }

        // Normalize Firebase UID
        if (typeof user.firebaseUid === "string") {
          user.firebaseUid = user.firebaseUid.trim() || null;
        }

        // Normalize avatar
        if (typeof user.avatar === "string") {
          user.avatar = user.avatar.trim() || null;
        }
      },

      // Hash password only when it is created or changed.
      beforeSave: async (user) => {
        if (user.changed("password") && user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

// ============================================
// PASSWORD COMPARISON
// ============================================

User.prototype.matchPassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) {
    return false;
  }

  return bcrypt.compare(String(enteredPassword), this.password);
};

// ============================================
// EXPORT
// ============================================

module.exports = User;