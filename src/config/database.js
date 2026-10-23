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
    dialectOptions: isProduction 
      ? {
          // AIVEN / PRODUCTION SECURE SETTINGS
          ssl: {
            require: true,
            rejectUnauthorized: false 
          }
        } 
      : {}, // LOCALHOST SETTINGS (No SSL required)
  }
);

module.exports = sequelize;