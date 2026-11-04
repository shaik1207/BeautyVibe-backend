const { Sequelize } = require('sequelize');
require('dotenv').config();


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

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: isProduction 
      ? {
          
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
          connectTimeout: 60000, 
        } 
      : {}, 
  }
);

module.exports = sequelize;