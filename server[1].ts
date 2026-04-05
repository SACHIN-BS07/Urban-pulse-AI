import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Nodemailer Transporter (Lazy initialization)
  let transporter: any = null;
  const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      throw new Error("SMTP credentials (host, port, user, pass) are not set in the environment. Please configure them in the Settings menu.");
    }

    if (!transporter) {
      if (host.includes('@')) {
        throw new Error(`Invalid SMTP_HOST: "${host}". It should be a server hostname (e.g., smtp.gmail.com), not an email address. Please check your environment variables in the Settings menu.`);
      }

      if (host.toLowerCase() === 'gmail.com') {
        throw new Error(`Invalid SMTP_HOST: "gmail.com". For Gmail, please use "smtp.gmail.com". Update this in the Settings menu.`);
      }

      transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465,
        auth: { user, pass }
      });
    }
    return transporter;
  };

  // API Route for Emergency Emails
  app.post("/api/send-emergency-email", async (req, res) => {
    const { location, description, severity, recipient: customRecipient, numberPlate, reporterName } = req.body;

    if (!location || !description || !severity) {
      return res.status(400).json({ error: "Location, description, and severity are required." });
    }

    try {
      const mailTransporter = getTransporter();
      const recipient = customRecipient || process.env.EMERGENCY_EMAIL_RECIPIENT;
      const user = process.env.SMTP_USER;

      if (!recipient) {
        return res.status(400).json({ error: "EMERGENCY_EMAIL_RECIPIENT is not set in the environment. Please configure it in the Settings menu." });
      }

      const mailOptions = {
        from: user,
        to: recipient,
        subject: `CRITICAL ALERT: Emergency report at ${location}`,
        text: `
          CRITICAL ALERT: Emergency report at ${location} has been emailed to the Police and Hospital.
          
          Location: ${location}
          Severity: ${severity}
          Reporter: ${reporterName || 'Anonymous'}
          Number Plate: ${numberPlate || 'Not detected'}
          Description: ${description}
          
          This is an automated message from UrbanPulse AI.
        `,
        html: `
          <h2>CRITICAL ALERT: Emergency report at ${location}</h2>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Severity:</strong> ${severity}</p>
          <p><strong>Reporter:</strong> ${reporterName || 'Anonymous'}</p>
          <p><strong>Number Plate:</strong> ${numberPlate || 'Not detected'}</p>
          <p><strong>Description:</strong> ${description}</p>
          <hr />
          <p><em>This is an automated message from UrbanPulse AI.</em></p>
        `
      };

      await mailTransporter.sendMail(mailOptions);
      res.json({ success: true, message: "Emergency email sent successfully." });
    } catch (error: any) {
      console.error("Email Error:", error);
      res.status(500).json({ error: error.message || "Failed to send emergency email." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
