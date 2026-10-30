// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

console.log("----------------------------------------");
console.log("DATABASE_URL DETECTED:", connectionString ? "YES (URL loaded)" : "NO (UNDEFINED!)");
console.log("----------------------------------------");

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => {
    console.log('Successfully connected to PostgreSQL Database!');
});

pool.on('error', (err) => {
    console.error('PostgreSQL client error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};