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
        const db = await database.connectToSlave();
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

app.post('/check_attendees', async (req, res) => { 
    const { roll_no } = req.body;
    const query = `SELECT * FROM attendee_student WHERE roll_no = ?`;
    try {
        const db = await database.connectToSlave();
        const [result] = await db.execute(query, [roll_no]);
        await db.end();

        if (result.length === 0) {
            res.status(409).send({ message: 'User not found or invalid user.' });
        } else {
            res.status(200).send(result[0]);
        }
    } catch (err) {
        console.error('Failed to check attendees:', err);
        res.status(500).send({ error: 'Failed to check attendees.' });
    }
});

app.post('/insert_attendees', async (req, res) => {
    const { roll_no, name, branch, program, batch } = req.body;
    const lookup = `SELECT * FROM attendee_student WHERE roll_no = ?`;
    const query = 'INSERT INTO attendee_student (roll_no, name, branch, program, batch) VALUES (?, ?, ?, ?, ?)';
    const update = `UPDATE student_data SET is_registered = ? WHERE roll_no = ?`;

    try {
        const db = await database.connectToMaster();

        // Check if the roll number already exists in attendee_student
        const [lookUpResult] = await db.execute(lookup, [roll_no]);
        if (lookUpResult.length !== 0) {
            res.status(409).send({ error: 'Duplicate data found.' });
            await db.end();
            return;
        }

        // Insert the new student record into attendee_student
        await db.execute(query, [roll_no, name, branch, program, batch]);

        // Update the is_registered flag in student_data
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
    }
});

app.post('/insert_guests', async (req, res) => {
    const { attendees, empty } = req.body;

    if (empty) {
        return res.status(200).send({ message: 'No guests to insert. The attendees list is empty.' });
    }

    if (!Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).send({ error: 'Invalid input: Expected a non-empty array of guest objects.' });
    }

    const query = 'INSERT INTO guest_data (roll_no, guest_name, relation, phone_no) VALUES (?, ?, ?, ?)';

    try {
        const db = await database.connectToMaster();
        await db.beginTransaction();

        for (const guest of attendees) {
            const { roll_no, guest_name, relation, phone_no } = guest;
            await db.execute(query, [roll_no, guest_name, relation, phone_no]);
        }

        await db.commit();
        await db.end();
        res.status(201).send({ message: 'Guests details inserted successfully!' });
    } catch (err) {
        console.error('Failed to insert guests details:', err);
        res.status(500).send({ error: 'Failed to insert guests details.' });
    }
});

app.get('/get_attendees', async (req, res) => {
    const { roll_no } = req.query;
    try {
        const db = await database.connectToSlave();
        const [guests] = await db.execute('SELECT * FROM guest_data WHERE roll_no = ?', [roll_no]);
        await db.end();
        res.status(200).send(guests);
    } catch (err) {
        console.error('Failed to get guests details:', err);
        res.status(500).send({ error: 'Failed to get guests details.' });
    }
});

app.post('/insert_pass_url', async (req, res) => {
    const { roll_no, pass_url } = req.body;
    const query = 'UPDATE attendee_student SET pass_url = ? WHERE roll_no = ?';

    try {
        const db = await database.connectToMaster();
        await db.execute(query, [pass_url, roll_no]);
        await db.end();
        res.status(200).send({ message: 'Pass URL updated successfully!' });
    } catch (err) {
        console.error('Failed to update pass URL:', err);
        res.status(500).send({ error: 'Failed to update pass URL.' });
    }
});

app.get('/get_pass_url', async (req, res) => {
    const { roll_no } = req.query;
    const query = 'SELECT pass_url FROM attendee_student WHERE roll_no = ?';

    try {
        const db = await database.connectToSlave();
        const [result] = await db.execute(query, [roll_no]);
        await db.end();

        if (result.length === 0) {
            res.status(404).send({ message: 'Pass URL not found.' });
        } else {
            res.status(200).send(result[0]);
        }
    } catch (err) {
        console.error('Failed to get pass URL:', err);
        res.status(500).send({ error: 'Failed to get pass URL.' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
