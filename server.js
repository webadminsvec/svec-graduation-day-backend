const database = require('./db.js');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Welcome to SVEC Graduation Server!');
});

app.get('/authenticate', async (req, res) => {
    const { branch, roll_no, aadhar } = req.query;

    const query = `SELECT * FROM ${branch} WHERE roll_no = ? AND aadhar = ?`;

    try {
        const db = await database.connectToDatabase();
        const [result] = await db.execute(query, [roll_no, aadhar]);
        await db.end();

        if (result.length === 0) {
            res.status(404).send({ message: 'User not found or invalid user.' });
        } else {
            res.status(200).send(result[0]);
        }
    } catch (err) {
        console.error('Failed to authenticate student:', err);
        res.status(500).send({ error: 'Failed to authenticate student.' });
    }
});

app.post('/insert_attendees', async (req, res) => {
    const { roll_no, name, branch } = req.body;
    const query = 'INSERT INTO attendee_student (roll_no, name, branch) VALUES (?, ?, ?)';
    const update = `UPDATE student_data SET is_registered = ? WHERE roll_no = ?`;
    const db = await database.connectToDatabase();

    try {
        
        const [result] = await db.execute(query, [roll_no, name, branch]);
        await db.execute(update, [true, roll_no]);
        await db.end();
        res.status(201).send({ message: 'Student details inserted successfully!' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).send({ error: 'Duplicate entry found.' });
            console.error('Duplicate entry found:', err.sqlMessage);
        } else {
            console.error('Failed to insert student details:', err);
            res.status(500).send({ error: 'Failed to insert student details.' });
        }
    } finally {
        if (db) await db.end(); // Ensure the connection is always closed
    }
});



app.post('/insert_guests', async (req, res) => {
    const attendees = req.body;
    const query = 'INSERT INTO guest_data (roll_no, guest_name, relation, phone_no) VALUES (?, ?, ?, ?)';

    if (!Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).send({ error: 'Invalid input: Expected an array of guest objects.' });
    }

    try {
        const db = await database.connectToDatabase();
        await db.beginTransaction();
        for (const guest of attendees) {
            const { roll_no, guest_name, relation, phone_no } = guest;
            await db.execute(query, [roll_no, guest_name, relation, phone_no]);
        }
        await db.commit();
        await db.end();
        res.status(201).send({ message: 'guests details inserted successfully!' });
    } catch (err) {
        console.error('Failed to insert guests details:', err);
        res.status(500).send({ error: 'Failed to insert guests details.' });
    }
});


app.get('/get_attendees', async (req, res) => {
    const { roll_no } = req.query;
    try {
        const db = await database.connectToDatabase();
        const [guests] = await db.execute('SELECT * FROM guest_data WHERE roll_no = ?', [roll_no]);
        await db.end();
        res.status(200).send(guests);
    } catch (err) {
        console.error('Failed to get guests details:', err);
        res.status(500).send({ error: 'Failed to get guests details.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
