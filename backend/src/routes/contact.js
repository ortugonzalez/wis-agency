const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

router.post("/", async (req, res) => {
  const { name, company, message, email } = req.body;

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "Los campos name, email y message son requeridos." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "El email no es válido." });
  }

  const transporter = createTransporter();

  try {
    // Notificación interna
    await transporter.sendMail({
      from: `"WIS Agency" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_EMAIL,
      replyTo: email,
      subject: `Nuevo contacto de ${name}${company ? ` - ${company}` : ""}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        ${company ? `<p><strong>Empresa:</strong> ${company}</p>` : ""}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    // Respuesta automática al visitante
    await transporter.sendMail({
      from: `"WIS Agency" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Recibimos tu mensaje - WIS Agency",
      html: `
        <p>Hola ${name},</p>
        <p>Gracias por contactarnos. Recibimos tu mensaje y nos pondremos en contacto contigo a la brevedad.</p>
        <br>
        <p>El equipo de WIS Agency</p>
        <p><a href="https://wis-agency.com">wis-agency.com</a></p>
      `,
    });

    return res.json({ success: true, message: "Mensaje enviado correctamente." });
  } catch (err) {
    console.error("Error sending email:", err.message);
    return res.status(500).json({ error: "Error al enviar el mensaje. Intentá más tarde." });
  }
});

module.exports = router;
