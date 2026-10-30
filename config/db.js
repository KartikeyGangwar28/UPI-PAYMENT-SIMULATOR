// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 20, // Max clients in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log(' Connected to PostgreSQL Database');
});

pool.on('error', (err) => {
    console.error(' Unexpected PostgreSQL client error', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
}; 