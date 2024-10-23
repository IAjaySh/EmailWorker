const amqplib = require('amqplib');
const nodemailer = require('nodemailer');
require('dotenv').config();

const RABBITMQ_URL = `amqps://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}/${process.env.RABBITMQ_USER}`;
const QUEUE_NAME = 'email_notifications';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const startWorker = async () => {
    const connection = await amqplib.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME);
    console.log('Waiting for messages in %s', QUEUE_NAME);

    channel.consume(QUEUE_NAME, async (msg) => {
        console.log("this is the message -> ", JSON.parse(msg.content.toString()));
        const { email } = JSON.parse(msg.content.toString());

        // Send email notification
        try {
            const mail = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Login Notification',
                text: 'You have successfully logged in to our project Netflix Clone!',
            });
            console.log(`Email sent to ${email}`);
            channel.ack(msg); // Acknowledge message
        } catch (error) {
            console.error('Error sending email:', error);
            channel.nack(msg); // Reject message
        }
    });
};

// Create a Vercel API route
module.exports = async (req, res) => {
    if (req.method === 'POST') {
        // Start the RabbitMQ worker
        try {
            await startWorker();
            res.status(200).json({ message: 'Worker started successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to start worker' });
        }
    } else {
        // Handle other HTTP methods
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};
