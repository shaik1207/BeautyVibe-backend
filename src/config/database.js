const { Sequelize } = require('sequelize');
require('dotenv').config();

// Detect if running on Render (production) or locally (development)
const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(
  process.env.DB_NAME || 'beautyvibe_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    // Connection pooling to maintain stable connection between Render & Aiven
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: isProduction 
      ? {
          // AIVEN / PRODUCTION SECURE SETTINGS
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
          connectTimeout: 60000, // Prevents sudden timeout drops on cold starts
        } 
      : {}, // LOCALHOST SETTINGS (No SSL required)
  }
);

module.exports = sequelize;