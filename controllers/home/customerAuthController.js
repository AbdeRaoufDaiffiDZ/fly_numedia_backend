const customerModel = require("../../models/customerModel");
const { responseReturn } = require("../../utiles/response");
const { createToken } = require("../../utiles/tokenCreate");
const sellerCustomerModel = require("../../models/chat/sellerCustomerModel");
const bcrypt = require("bcrypt");
const {
  send_email,
} = require("../../controllers/notification/notificationController");
class customerAuthController {
  customer_register = async (req, res) => {
    const { name, email, phone, password } = req.body;
    try {
      const customer = await customerModel.findOne({ email });
      const role = "customer";
      if (customer) {
        return responseReturn(res, 404, { error: "L'e-mail existe déjà" });
      }

      // Create new customer
      const createCustomer = await customerModel.create({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'customer',
        password: await bcrypt.hash(password, 10),
        method: "manual",
      });
      
      // Create related sellerCustomer entry
      await sellerCustomerModel.create({
        myId: createCustomer.id,
      });

      // Generate a token
      const token = await createToken({
        id: createCustomer.id,
        name: createCustomer.name,
        email: createCustomer.email,
        phone: createCustomer.phone,
        method: createCustomer.method,
        role: createCustomer.role,
      });

      // Set the cookie with the token
      res.cookie("customerToken", token, {
        expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // expires in 1 day
      });

      // Send email to admin about the new registration
      const adminEmail = "work.flynumedia@gmail.com";
      const subjectAdmin = "Nouvelle inscription Client";
      const titleAdmin = "Vous avez une nouvelle inscription client";
      const descriptionAdmin =
        "Un nouvel utilisateur s'est inscrit sur la plateforme. Voici les détails de l'utilisateur:";
      const details = { name, email, phone };
      console.log("try to send email");
      await send_email({
        adminEmail,
        subject: subjectAdmin,
        title: titleAdmin,
        description: descriptionAdmin,
        details: details,
        sendToAdmin: true,
        sendToSellers: false,
        sendToClient: false,
      });

      // Send a welcome email to the new user
      const clientEmail = email;
      const subjectClient = "Bienvenue sur Fly Numedia";
      const titleClient = "Merci pour votre inscription!";
      const descriptionClient =
        "Bienvenue sur Fly Numedia! Nous sommes ravis de vous accueillir sur notre plateforme. Voici vos informations d'inscription:";
      console.log("try to send to client");
      console.log(clientEmail);

      await send_email({
        clientEmail,
        subject: subjectClient,
        title: titleClient,
        description: descriptionClient,
        details: details,
        sendToAdmin: false,
        sendToSellers: false,
        sendToClient: true,
      });
      console.log("send done");
      
      // Return success response
      responseReturn(res, 201, { message: "Register success", token, role  });
    } catch (error) {
      console.error("Error in customer_register:", error.message);
      responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  customer_login = async (req, res) => {
    const { email, password } = req.body;
    try {
      console.log("ask login for customer");

      const customer = await customerModel
        .findOne({ email })
        .select("+password");
      if (customer) {
        const match = await bcrypt.compare(password, customer.password);
        if (match) {
          const token = await createToken({
            id: customer.id,
            name: customer.name,
            email: customer.email,
            method: customer.method,
            role: customer.role
          });
          res.cookie("customerToken", token, {
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          responseReturn(res, 201, { message: "Login success", token });
        } else {
          responseReturn(res, 404, { error: "Password wrong" });
        }
      } else {
        responseReturn(res, 404, { error: "Email not found" });
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  customer_send_reset_code = async (req, res) => {
    const { email } = req.body;
    console.log("ask for rest code");
    try {
      const customer = await customerModel.findOne({ email });
      if (!customer) {
        return responseReturn(res, 404, { error: "L'e-mail n'existe pas" });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedCode = await bcrypt.hash(code, 10);
      const expiry = Date.now() + 5 * 60 * 1000;

      customer.resetCode = hashedCode;
      customer.resetCodeExpiry = expiry;
      await customer.save();

      const details = { name: customer.name, email, phone: customer.phone };

      await send_email({
        clientEmail: email,
        subject: "Code de réinitialisation du mot de passe",
        title: "Réinitialisation du mot de passe",
        description: `Votre code de réinitialisation est : <b>${code}</b>. Il expirera dans 5 minutes.`,
        details: details,
        sendToAdmin: false,
        sendToSellers: false,
        sendToClient: true,
      });

      responseReturn(res, 200, {
        message: "Code envoyé avec succès à votre e-mail.",
      });
    } catch (error) {
      console.error("Error in customer_send_reset_code:", error.message);
      responseReturn(res, 500, { error: "Erreur interne du serveur" });
    }
  };

  customer_verify_code = async (req, res) => {
    const { email, code } = req.body;
    console.log("verify code");
    try {
      const customer = await customerModel
        .findOne({ email })
        .select("+resetCode");
      if (!customer) {
        return responseReturn(res, 404, { error: "L'e-mail n'existe pas" });
      }
      console.log(customer.resetCodeExpiry);
      console.log(customer.resetCode);

      if (!customer.resetCodeExpiry || customer.resetCodeExpiry < Date.now()) {
        return responseReturn(res, 400, {
          error: "Le code a expiré. Veuillez demander un nouveau code.",
        });
      }

      const codeMatch = await bcrypt.compare(code, customer.resetCode);
      if (!codeMatch) {
        return responseReturn(res, 400, { error: "Code invalide." });
      }

      return responseReturn(res, 200, { message: "Code vérifié avec succès." });
    } catch (error) {
      console.error("Error in customer_verify_code:", error.message);
      return responseReturn(res, 500, { error: "Erreur interne du serveur" });
    }
  };

  customer_reset_password = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
      const customer = await customerModel.findOne({ email });
      if (!customer) {
        return responseReturn(res, 404, { error: "L'e-mail n'existe pas" });
      }

      if (!customer.resetCodeExpiry || customer.resetCodeExpiry < Date.now()) {
        return responseReturn(res, 400, {
          error: "Le code a expiré. Veuillez demander un nouveau code.",
        });
      }

      const codeMatch = await bcrypt.compare(code, customer.resetCode);
      if (!codeMatch) {
        return responseReturn(res, 400, { error: "Code invalide." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      customer.password = hashedPassword;
      customer.resetCode = undefined;
      customer.resetCodeExpiry = undefined;

      await customer.save();

      await send_email({
        clientEmail: email,
        subject: "Votre mot de passe a été modifié",
        title: "Confirmation de modification du mot de passe",
        description: `Bonjour ${customer.name},<br><br>Votre mot de passe a été modifié avec succès. Si vous n'êtes pas à l'origine de cette action, veuillez nous contacter immédiatement.`,
        details: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        sendToAdmin: false,
        sendToSellers: false,
        sendToClient: true,
      });

      return responseReturn(res, 200, {
        message: "Mot de passe réinitialisé avec succès.",
      });
    } catch (error) {
      console.error("Error in customer_reset_password:", error.message);
      return responseReturn(res, 500, { error: "Erreur interne du serveur" });
    }
  };

  customer_logout = async (req, res) => {
    res.cookie("customerToken", "", {
      expires: new Date(Date.now()),
    });
    responseReturn(res, 200, { message: "Logout success" });
  };
}

module.exports = new customerAuthController();
