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
      if (customer) {
        return responseReturn(res, 404, { error: "L'e-mail existe déjà" });
      }

      // Create new customer
      const createCustomer = await customerModel.create({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
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

      // Return success response
      responseReturn(res, 201, { message: "Register success", token });
    } catch (error) {
      console.error("Error in customer_register:", error.message);
      responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  customer_login = async (req, res) => {
    const { email, password } = req.body;
    try {
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

  customer_logout = async (req, res) => {
    res.cookie("customerToken", "", {
      expires: new Date(Date.now()),
    });
    responseReturn(res, 200, { message: "Logout success" });
  };
}

module.exports = new customerAuthController();
