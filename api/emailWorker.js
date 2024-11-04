const express = require('express');
const amqplib = require('amqplib');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const RABBITMQ_URL = `amqps://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}/${process.env.RABBITMQ_USER}`;
const QUEUE_NAME = 'email_notifications';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

let connection = null;
let channel = null;

const startWorker = async () => {
    if (connection && channel) {
        console.log('Worker is already running');
        return;
    }

    connection = await amqplib.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME);
    console.log('Waiting for messages in %s', QUEUE_NAME);

    channel.consume(QUEUE_NAME, async (msg) => {
        console.log("This is the message -> ", JSON.parse(msg.content.toString()));
        const { email } = JSON.parse(msg.content.toString());

        try {
            const mail = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Login Notification',
                text: 'You have successfully logged in to our project Netflix Clone!',
            });
            console.log(`Email sent to ${email}`);
            channel.ack(msg);
        } catch (error) {
            console.error('Error sending email:', error);
            channel.nack(msg);
        }
    });
};

const stopWorker = async () => {
    if (channel) {
        await channel.close();
        channel = null;
        console.log('Worker channel closed');
    }
    if (connection) {
        await connection.close();
        connection = null;
        console.log('Worker connection closed');
    }
};

// Express routes for starting and stopping the worker
app.post('/start', async (req, res) => {
    try {
        await startWorker();
        res.status(200).json({ message: 'Worker started successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start worker' });
    }
});

app.post('/stop', async (req, res) => {
    try {
        await stopWorker();
        res.status(200).json({ message: 'Worker stopped successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to stop worker' });
    }
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
