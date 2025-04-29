const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Email sending function with flexibility
const send_email = async ({
  adminEmail, // Default admin email
  sellerEmails = [], // Optional partner email
  clientEmail, // Optional client email
  subject,
  title,
  description,
  details,
  attachments = [],
  sendToAdmin = true, // Whether to send email to admin
  sendToSellers = true, // Whether to send email to admin
  sendToClient = true, // Whether to send email to client
}) => {
  try {
    // Configure the transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT === "465", // Use SSL if port is 465
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Validate attachments
    const validAttachments = attachments
      .filter(
        (file) =>
          typeof file.path === "string" && typeof file.filename === "string"
      )
      .map((file) => ({
        filename: file.filename,
        path: file.path,
      }));

    console.log("Valid attachments:", validAttachments);

    // Prepare email options for each recipient
    const recipients = [];
    if (sendToAdmin) recipients.push(adminEmail);
    if (sendToSellers && sellerEmails.length > 0) {
      recipients.push(...sellerEmails); // Add seller emails if provided
    }
    if (sendToClient && clientEmail) recipients.push(clientEmail);

    const mailOptions = recipients.map((toEmail) => ({
      from: `"Fly Numedia" <${process.env.SMTP_EMAIL}>`,
      to: toEmail,
      subject,
      html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>${title}</title>
              <style>
                body {
                  background-color: #f2f5f8;
                  margin: 0;
                  padding: 20px 0;
                  font-family: Arial, sans-serif;
                }
                .container {
                  max-width: 600px;
                  width: 90%;
                  margin: 20px auto;
                  background-color: #deecff;
                  border: 2px solid #ff7ff6;
                  border-radius: 20px;
                  overflow: hidden;
                }
                .header {
                  text-align: center;
                  padding: 20px;
                  background: rgb(222, 236, 255);
                  background: linear-gradient(0deg, #120004 0%, #3f028d 100%);
                  border-bottom: 2px solid #ff7ff6;
                }
                .header img {
                  height: 55px;
                  max-width: 180px;
                  object-fit: contain;
                }
                .content {
                  padding: 30px 20px;
                }
                .content p {
                  margin: 10px 0;
                  color: #3a0736;
                }
                .content span {
                  font-weight: bold;
                }
                .footer {
                  text-align: center;
                  padding: 20px;
                  background: #deecff;
                  background: linear-gradient(0deg, #3f028d 0%, #120004 100%);
                  border-top: 2px solid #ff7ff6;
                  font-size: 14px;
                }
                .footer h3 {
                  margin: 3px 0;
                  color: #deecff;
                  font-size: 14px;
                }
                .footer a {
                  color: #ff7ff6;
                  text-decoration: none;
                  font-size: 14px;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <!-- Header Section -->
                <div class="header">
                  <img src="https://flynumedia.com/images/logo.png" alt="Fly Numedia" />
                </div>
          
                <!-- Content Section -->
                <div class="content">
                  <p><span>${title}</span></p>
                  <p><span>-</span> ${description}</p>
                  <p><span>Nom:</span> ${details.name}</p>
                  <p><span>Email:</span> ${details.email}</p>
                  <p>${
                    details.phone
                      ? `<span>Téléphone:</span> ${details.phone}`
                      : ""
                  }</p>
                  <p>${
                    details.role ? `<span>Rôle:</span> ${details.role}` : ""
                  }</p>
                  <p>${
                    details.paymentStatus
                      ? `<span>Paiement:</span> ${details.paymentStatus}`
                      : ""
                  }</p>
                  <p>${
                    details.address
                      ? `<span>Addresse:</span> ${details.address}`
                      : ""
                  }</p>
                  <p>${
                    details.price ? `<span>Prix:</span> ${details.price}` : ""
                  }</p>
                  <p>${
                    details.orderId ? `<span>ID:</span> ${details.orderId}` : ""
                  }</p>
                  
                </div>
          
                <div class="footer">
                  <h3>Merci d'avoir choisi Fly Numedia!</h3>
                  <h3>Cordialement, L'équipe FLY NUMEDIA</h3>
                  <a href="https://flynumedia.com/" target="_blank">flynumedia.com</a>
                </div>
              </div>
            </body>
          </html>

          
        `,
      attachments: validAttachments, // Attach valid attachments
    }));

    // Send emails to all recipients
    await Promise.all(
      mailOptions.map((options) => transporter.sendMail(options))
    );

    console.log("Email(s) sent successfully.");
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new Error("Failed to send email");
  }
};

module.exports = { send_email };
