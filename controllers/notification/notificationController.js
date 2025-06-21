const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");


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
  isBook = false,
  logoPath = path.join(__dirname, 'assets', 'logo.png') // <--- Add this new parameter for local logo path
}) => {
  try {
    // Dynamically import nodemailer if not already available in the scope
    // This assumes `nodemailer` is an installed dependency in your project.
    const nodemailer = await import('nodemailer');
    const path = await import('path'); // Ensure 'path' module is available
    console.log(clientEmail);
    if (details != null) {
      console.log(details.firstName);
      console.log(details.passportNumber);
      console.log(description);
    }
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

    // Validate and prepare attachments
    const validAttachments = attachments
      .filter(
        (file) =>
          typeof file.path === "string" && typeof file.filename === "string"
      )
      .map((file) => ({
        filename: file.filename,
        path: file.path,
      }));

    // --- Add the local logo as an embedded attachment ---
    const logoCid = 'uniqueLogoCid'; // A unique content ID for your logo

    // Ensure logoPath is provided and valid before pushing
    if (logoPath) {
      validAttachments.push({
        filename: 'logo.png', // The filename that will appear in the attachment (can be anything)
        path: logoPath,        // The actual local path to your logo file
        cid: logoCid           // This Content ID allows referencing it in the HTML
      });
    }
    // --- End of logo embedding setup ---

    console.log("Valid attachments (including logo):", validAttachments);

    // Prepare email options for each recipient
    const recipients = [];
    if (sendToAdmin) recipients.push(adminEmail);
    if (sendToSellers && sellerEmails.length > 0) {
      recipients.push(...sellerEmails); // Add seller emails if provided
    }
    if (sendToClient && clientEmail) recipients.push(clientEmail);

    const appColor = '#3C59D8'; // Main blue color
    const appColorDark = '#2A44B0'; // A darker shade for the gradient
    const lightAppColor = '#ffffff'; // A lighter shade for backgrounds
    const darkTextColor = '#333333';
    const lightTextColor = '#ffffff';
    const borderColor = 'rgba(60, 89, 216, 0.5)'; // A slightly transparent border

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
                background-color: #f7f9fc; /* Lighter background */
                margin: 0;
                padding: 20px 0;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; /* Modern font */
                line-height: 1.6;
                color: ${darkTextColor};
              }
              .container {
                max-width: 600px;
                width: 90%;
                margin: 20px auto;
                background-color: ${lightTextColor};
                border: 1px solid ${borderColor}; /* Softer border */
                border-radius: 12px; /* More modern rounded corners */
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Subtle shadow */
              }
              .header {
                text-align: center;
                padding: 30px 20px;
                /* Gradient background */
                background: linear-gradient(to right, ${appColor}, ${appColorDark});
                color: ${lightTextColor};
                border-bottom: 1px solid ${borderColor};
              }
              .header img {
                height: 60px; /* Slightly larger logo */
                max-width: 200px;
                object-fit: contain;
                /* filter: brightness(0) invert(1); Uncomment this if your logo is dark and needs to be white against the blue background */
              }
              .header h1 {
                margin: 10px 0 0;
                font-size: 24px;
                font-weight: bold;
              }
              .content {
                padding: 30px;
              }
              .content p {
                margin: 12px 0;
                color: ${darkTextColor};
                font-size: 16px;
              }
              .content span {
                font-weight: 600; /* Medium bold */
                color: ${appColor}; /* Highlight key info with app color */
              }
              .button {
                display: inline-block;
                background-color: ${appColor};
                color: ${lightTextColor} !important; /* !important to override default link styles */
                padding: 12px 25px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: bold;
                margin-top: 20px;
                transition: background-color 0.3s ease;
              }
              .button:hover {
                background-color: ${appColor}e6; /* Slightly darker on hover */
              }
              .footer {
                text-align: center;
                padding: 25px 20px;
                background-color: ${lightAppColor}; /* Lighter shade of app color */
                border-top: 1px solid ${borderColor};
                font-size: 13px;
                color: ${darkTextColor};
              }
              .footer h3 {
                margin: 5px 0;
                color: ${appColor};
                font-size: 15px;
              }
              .footer a {
                color: ${appColor};
                text-decoration: none;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="cid:${logoCid}" alt="Fly Numedia Logo" />
                <h1>${title}</h1>
              </div>
        
              <div class="content">
                <p>${description}</p>
                ${details.lastName ? `<p><span>Nom:</span> ${details.lastName || ''}</p>` : ""}
                <p><span>Email:</span> ${details.email || ''}</p>
                ${details.phone ? `<p><span>Téléphone:</span> ${details.phone}</p>` : ""}
                ${details.role ? `<p><span>Rôle:</span> ${details.role}</p>` : ""}
                ${details.paymentStatus ? `<p><span>Statut de Paiement:</span> ${details.paymentStatus}</p>` : ""}
                ${details.address ? `<p><span>Adresse:</span> ${details.address}</p>` : ""}
                ${details.price ? `<p><span>Prix:</span> ${details.price}</p>` : ""}
                ${details.orderId ? `<p><span>ID de Commande:</span> ${details.orderId}</p>` : ""}
                ${details.passportNumber ? `<p><span>Numéro de passeport:</span> ${details.passportNumber}</p>` : ""}

                ${details.callToActionLink && details.callToActionText ?
          `<p style="text-align: center;"><a href="${details.callToActionLink}" class="button">${details.callToActionText}</a></p>` : ""
        }
              </div>
        
              <div class="footer">
                <h3>Merci d'avoir choisi Fly Numedia!</h3>
                <p>Cordialement, L'équipe FLY NUMEDIA</p>
              </div>
            </div>
          </body>
        </html>
        `,
      // <a href="https://flynumedia.com/" target="_blank">flynumedia.com</a>

      attachments: validAttachments, // Pass all attachments including the embedded logo
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
