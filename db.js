const mysql = require('mysql2/promise');
require('dotenv').config();


async function connectToDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        return connection;
    } catch (err) {
        console.error('Failed to connect to the database:', err);
        throw err;
    }
}

exports.connectToDatabase = connectToDatabase;
