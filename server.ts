import express from 'express';
import { createServer as createViteServer } from 'vite';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Emergency Notification Endpoint
app.post('/api/emergency', async (req, res) => {
  const { category, location, severity, action, description } = req.body;

  try {
    // 1. Twilio SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `URGENT ALERT: ${category} at ${location}. Severity: ${severity}/10. Action required: ${action}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: process.env.EMERGENCY_PHONE_NUMBER as string,
      });
      console.log('SMS Sent');
    }

    // 2. Nodemailer Email
    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"UrbanPulse AI Dispatch" <dispatch@urbanpulse.ai>',
        to: process.env.EMERGENCY_EMAIL_RECIPIENT,
        subject: `🚨 CRITICAL INCIDENT: ${category} Detected`,
        html: `
          <h2>Emergency AI Dispatch</h2>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Severity Level:</strong> ${severity}/10</p>
          <p><strong>AI Analysis:</strong> ${description}</p>
          <p><strong>Recommended Action:</strong> ${action}</p>
        `,
      });
      console.log('Email Sent');
    }

    res.json({ success: true, message: 'Emergency contacts notified successfully.' });
  } catch (error) {
    console.error('Notification Error:', error);
    res.status(500).json({ success: false, error: 'Failed to send notifications' });
  }
});

async function startServer() {
  if (isProd) {
    const dist = path.resolve(__dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: __dirname,
    });
    app.use(vite.middlewares);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 UrbanPulse Unified Server running on http://localhost:${PORT}`);
  });
}

startServer();
