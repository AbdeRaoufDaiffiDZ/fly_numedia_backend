const adminModel = require("../models/adminModel");
const sellerModel = require("../models/sellerModel");
const customoerModel = require("../models/customerModel");
const sellerCustomerModel = require("../models/chat/sellerCustomerModel");
const bcrpty = require("bcrypt");
const formidable = require("formidable");
const cloudinary = require("cloudinary").v2;
const { responseReturn } = require("../utiles/response");
const { createToken } = require("../utiles/tokenCreate");
const { send_email } = require("./notification/notificationController");
class authControllers {
  admin_login = async (req, res) => {
    const { email, password } = req.body;
    try {
      const admin = await adminModel.findOne({ email }).select("+password");
      if (admin) {
        const match = await bcrpty.compare(password, admin.password);
        if (match) {
          const token = await createToken({
            id: admin.id,
            role: admin.role,
          });
          res.cookie("accessToken", token, {
            httpOnly: true,
            secure: true, // Enable for HTTPS
            sameSite: "None", // Cross-origin compatibility
            expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
          });
          responseReturn(res, 200, { token, message: "Login success" });
        } else {
          responseReturn(res, 404, { error: "Password wrong" });
        }
      } else {
        responseReturn(res, 404, { error: "Email not found" });
      }
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  };

  seller_login = async (req, res) => {
    const { email, password } = req.body;
    try {
      const seller = await sellerModel.findOne({ email }).select("+password");
      if (seller) {
        const match = await bcrpty.compare(password, seller.password);
        if (match) {
          const token = await createToken({
            id: seller.id,
            role: seller.role,
          });
          res.cookie("accessToken", token, {
            httpOnly: true,
            secure: true, // Enable for HTTPS
            sameSite: "None", // Cross-origin compatibility
            expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
          });
          responseReturn(res, 200, { token, message: "Login success" });
        } else {
          responseReturn(res, 404, { error: "Password wrong" });
        }
      } else {
        responseReturn(res, 404, { error: "Email not found" });
      }
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  };

  seller_register = async (req, res) => {
    const { name, email, phone, role, password } = req.body;
    try {
      const getUser = await sellerModel.findOne({ email });
      if (getUser) {
        responseReturn(res, 404, { error: "Email alrady exit" });
      } else {
        const seller = await sellerModel.create({
          name,
          email,
          phone,
          role,
          password: await bcrpty.hash(password, 10),
          method: "manual",
          shopInfo: {},
        });
        await sellerCustomerModel.create({
          myId: seller.id,
        });
        const token = await createToken({ id: seller.id });
        res.cookie("accessToken", token, {
          httpOnly: true,
          secure: true, // Enable for HTTPS
          sameSite: "None", // Cross-origin compatibility
          expires: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        });

        // Send email to admin about the new registration
        const adminEmail = "work.flynumedia@gmail.com";
        const subjectAdmin = "Nouvelle inscription Partenaire";
        const titleAdmin = "Vous avez une nouvelle inscription partenaire";
        const descriptionAdmin =
          "Un nouvel partenair s'est inscrit sur la plateforme. Voici les détails de l'utilisateur:";
        const details = { name, email, phone, role };

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
        const sellerEmails = [email];
        const subjectPartner = "Bienvenue sur Fly Numedia";
        const titlePartner = "Merci pour votre inscription!";
        const descriptionPartner =
          "Bienvenue sur Fly Numedia! Nous sommes ravis de vous accueillir sur notre plateforme. Voici vos informations d'inscription:";

        await send_email({
          sellerEmails,
          subject: subjectPartner,
          title: titlePartner,
          description: descriptionPartner,
          details: details,
          sendToAdmin: false,
          sendToSellers: true,
          sendToClient: false,
        });

        responseReturn(res, 201, { token, message: "register success" });
      }
    } catch (error) {
      responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  getUser = async (req, res) => {
    const { id, role } = req;
    console.log(`req to get client: ${id}`);
    console.log(`req from role: ${role}`)
    try {
      if (role === "admin") {
        const user = await adminModel.findById(id);
        responseReturn(res, 200, { userInfo: user });
      } else if (role === "partner" || role === "guide") {µ
        
        const seller = await sellerModel.findById(id);
        responseReturn(res, 200, { userInfo: seller });
      } else if (role === "customer") {
        const customer = await customoerModel.findById(id);
        responseReturn(res, 200, { userInfo: customer });
      } else {
        responseReturn(res, 404, { error: "User not found" });
      }
    } catch (error) {
      responseReturn(res, 500, { error: "Internal server error" });
    }
  };

  customer_edit_profile = async (req, res) => {
    const { firstName, lastName, sex, dateOfBirth, nationality, passportNumber, passportExpirationDate, email, phone} = req.body;
    try {
      let customer = await customoerModel.findOne({ email });
      const role = "customer";
      if (!customer) {
        return responseReturn(res, 404, { error: "L'e-mail n'existe pas" });
      }
      console.log(lastName);
      // Create new customer
      customer.firstName = firstName;
      customer.lastName = lastName;
      customer.sex = sex;
      customer.dateOfBirth = dateOfBirth;
      customer.nationality = nationality;
      if (!passportNumber)
        customer.passportNumber = passportNumber;
      if (!passportExpirationDate)
        customer.passportExpirationDate = passportExpirationDate
      customer.phone = phone;
      await customer.save();

      // Create related sellerCustomer entry
      const details = { lastName, email, phone };


      // Generate a token
      const token = await createToken({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        sex: customer.sex,
        dateOfBirth: customer.dateOfBirth,
        nationality: customer.nationality,
        email: customer.email,
        phone: customer.phone,
        method: customer.method,
        role: customer.role,
      });

      // Set the cookie with the token
      res.cookie("customerToken", token, {
        expires: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // expires in 1 day
      });
      // Send a welcome email to the new user
      const clientEmail = email;
      const subjectClient = "Les informations du compte ont été modifiées Fly Numedia";
      const titleClient = "quelqu'un a modifié les informations de votre profil";
      const descriptionClient =
        "vos informations de compte ont été modifiées, si vous n'êtes pas vous qui avez modifié, veuillez nous contacter dès que possible";
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
      responseReturn(res, 201, { message: "user info updated", token });
    } catch (error) {
      console.error("Error in user info update:", error.message);
      responseReturn(res, 500, { error: "Internal server error" });
    }
  };


  profile_image_upload = async (req, res) => {
    const { id } = req;
    const form = formidable({ multiples: true });
    form.parse(req, async (err, _, files) => {
      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.api_key,
        api_secret: process.env.api_secret,
        secure: true,
      });
      const { image } = files;
      try {
        const result = await cloudinary.uploader.upload(image.filepath, {
          folder: "profile",
        });
        if (result) {
          await sellerModel.findByIdAndUpdate(id, {
            image: result.url,
          });
          const userInfo = await sellerModel.findById(id);
          responseReturn(res, 201, {
            message: "image upload success",
            userInfo,
          });
        } else {
          responseReturn(res, 404, { error: "image upload failed" });
        }
      } catch (error) {
        console.log(error);
        responseReturn(res, 500, { error: error.message });
      }
    });
  };

  profile_info_add = async (req, res) => {
    const { division, district, shopName, sub_district, description } =
      req.body;
    const { id } = req;

    try {
      await sellerModel.findByIdAndUpdate(id, {
        shopInfo: {
          shopName,
          division,
          district,
          sub_district,
          description,
        },
      });
      const userInfo = await sellerModel.findById(id);
      responseReturn(res, 201, {
        message: "Profile info add success",
        userInfo,
      });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  };

  logout = async (req, res) => {
    try {
      res.cookie("accessToken", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
      });
      responseReturn(res, 200, { message: "logout success" });
    } catch (error) {
      responseReturn(res, 500, { error: error.message });
    }
  };
}
module.exports = new authControllers();
