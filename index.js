const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const serviceAccount = require(process.env.SERVICE_ACCOUNT);

const app = express();
const PORT = process.env.PORT;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});

const db = admin.firestore();

app.use(bodyParser.json());


// Endpoint para enviar una notificación a un usuario específico
app.post("/notify", async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    res.status(200).send(`Mensaje enviado correctamente: ${response}`);
  } catch (error) {
    res.status(500).send(`Error al enviar el mensaje: ${error}`);
  }
});

// Endpoint para enviar notificación a todos los empleados de un rol
app.post("/notify-role", async (req, res) => {
  const { title, body, role } = req.body;

  try {
    const employeeTokens = [];
    const querySnapshot = await db
      .collection("usuarios")
      .where("perfil", "==", role)
      .get();
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        employeeTokens.push(data.token);
      }
    });

    if (employeeTokens.length === 0) {
      return res
        .status(404)
        .send("No hay usuarios a los que enviar un mensaje");
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: employeeTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send(`Mensajes enviados: ${response.successCount}`);
  } catch (error) {
    res.status(500).send(`Error al enviar mensaje: ${error}`);
  }
});

// Endpoint para enviar un mail a un usuario
app.post("/send-mail", async (req, res) => {
  try {
    const { aceptacion, nombreUsuario, mail } = req.body;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL,
        pass: process.env.PASSWORD,
      },
    });

    
    let resultado = await transporter.sendMail({
      from: '"Trío Gourmet" <triogourmet.spa.bou.vid@gmail.com>',
      to: mail,
      subject: "Cambios en su cuenta de Trío Gourmet",
      html: `
      <div style="font-family: Arial, sans-serif; color: #333; text-align: center; padding: 20px;">

        <img src="cid:logo" alt="Trío Gourmet Logo" style="width: 120px; height: auto; margin-bottom: 20px;"/>
        
        <h1 style="color: #555;">¡Hola ${nombreUsuario}!</h1>

        <p style="font-size: 18px; line-height: 1.6;">
          Le informamos que el estado de su cuenta en <strong>Trío Gourmet</strong> ha cambiado:
        </p>

        <h2 style="color: ${aceptacion ? '#4CAF50' : '#E53935'};">
          ${aceptacion ? "Cuenta Aceptada" : "Cuenta Rechazada"}
        </h2>

        <p style="font-size: 16px; margin-top: 20px;">
          ${
            aceptacion ? 
            "¡Bienvenido a nuestra comunidad! Nos complace tenerlo con nosotros." 
            : "Lamentablemente, no podemos aceptar su cuenta en este momento. Para más información, contáctenos."
          }
        </p>
        
        <p style="margin-top: 30px; font-size: 14px; color: #777;">
          Saludos cordiales,<br/>
          <strong>Equipo Trío Gourmet</strong>
        </p>
      </div>
      `,
      attachments: [
        {
          filename: "logo.png",
          path: "./logo.png",
          cid: "logo",
        },
      ],
    });
    res.json({ ...resultado, seEnvio: true });
  } catch (e) {
    res.json({
      mensaje: "No se pudo enviar el mail",
      seEnvio: false,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
