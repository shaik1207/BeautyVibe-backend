const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Service name is required.",
        },
        len: {
          args: [2, 150],
          msg: "Service name must contain 2 to 150 characters.",
        },
      },
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Service category is required.",
        },
      },
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isDecimal: {
          msg: "Enter a valid service price.",
        },
        min: {
          args: [0],
          msg: "Price cannot be negative.",
        },
      },
    },

    duration: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "60 mins",
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // LONGTEXT is required for Base64 images and large URLs.
    image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    benefits: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [
        "Personalized consultation",
        "Professional tools & hygiene",
        "Finishing expert advice",
      ],
    },

    isTrending: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    discountApplicable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "services", // Fixed lowercase table name to prevent Linux/Render 500 errors
    timestamps: true,
  }
);

module.exports = Service;