const nodemailer = require("nodemailer");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const authOrderModel = require("../../models/authOrder");
const customerOrder = require("../../models/customerOrder");
const cardModel = require("../../models/cardModel");
const myShopWallet = require("../../models/myShopWallet");
const sellerWallet = require("../../models/sellerWallet");
const sellerModel = require("../../models/sellerModel");
const { send_email } = require("../notification/notificationController");

const {
  mongo: { ObjectId },
} = require("mongoose");
const { responseReturn } = require("../../utiles/response");

const stripe = require("stripe")(process.env.STRIPE_API_KEY);

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files to the "uploads" folder
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name with extension
  },
});

// Set file filter and size limit
const fileFilter = (req, file, cb) => {
  if (["image/png", "image/jpeg", "application/pdf"].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PNG, JPG, or PDF allowed."));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit
  fileFilter,
}).array("documents", 5);

class orderController {
  //testing controller
  sendEmailController = async (req, res) => {
    try {
      console.log("Request Body:", req.body);

      const {
        adminEmail,
        sellerEmails,
        clientEmail,
        subject,
        title,
        description,
        details,
        attachments,
        sendToAdmin,
        sendToClient,
      } = req.body;

      if (!adminEmail && !clientEmail) {
        return res.status(400).json({ error: "No recipients defined" });
      }

      await send_email({
        adminEmail,
        sellerEmails,
        clientEmail,
        subject,
        title,
        description,
        details,
        attachments,
        sendToAdmin,
        sendToClient,
      });

      res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error in sendEmailController:", error.message);
      res.status(500).json({ error: "Failed to send email" });
    }
  };

  upload_document = async (req, res) => {
    upload(req, res, async (err) => {
      if (err) {
        console.error("Upload error:", err);
        return res.status(400).json({ error: err.message });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { orderId } = req.body;

      try {
        const order = await customerOrder
          .findById(orderId)
          .populate("products.sellerId");
        if (!order) {
          return res.status(404).json({ error: "Order not found." });
        }

        if (!order.documents) {
          order.documents = [];
        }

        // Add uploaded file paths to the order's documents array
        req.files.forEach((file) => {
          order.documents.push({
            name: file.originalname,
            path: file.path, // Save the file path
          });
        });

        await order.save();

        // Prepare attachments for email
        const attachments = req.files.map((file) => ({
          filename: file.originalname,
          path: file.path,
        }));

        console.log("Attachments:", attachments);

        // Extract product names for the email title
        const productNames = order.products
          .map((product) => product.name)
          .join(", ");

        // Fetch seller emails from the order products
        const sellerEmails = await Promise.all(
          Array.from(new Set(order.products.map((product) => product.sellerId)))
            .filter((sellerId) => sellerId) // Ensure valid sellerId
            .map(async (sellerId) => {
              const seller = await sellerModel.findById(sellerId);
              return seller ? seller.email : null;
            })
        );

        const uniqueSellerEmails = sellerEmails.filter((email) => email); // Remove null or undefined emails

        console.log("Seller Emails:", sellerEmails);

        // Email details
        const adminEmail = "work.flynumedia@gmail.com"; // Replace with actual admin email
        const subject = "Soumission de documents pour les visas";
        const title = `Visas: ${productNames}`;
        const details = {
          name: order.shippingInfo.name,
          email: order.shippingInfo.email,
          phone: order.shippingInfo.phone,
          paymentStatus: order.payment_status,
        };
        const description =
          "Veuillez traiter la demande dans les plus brefs délais.";

        // Send email to admin and sellers
        await send_email({
          adminEmail,
          sellerEmails: uniqueSellerEmails,
          subject,
          title,
          description,
          details,
          attachments,
          sendToAdmin: true,
          sendToSellers: true,
          sendToClient: false,
        });

        return res.status(200).json({
          message: "Documents uploaded successfully.",
          documents: order.documents,
        });
      } catch (error) {
        console.error("Error saving documents:", error);
        return res.status(500).json({ error: error.message });
      }
    });
  };

  getDocuments = async (req, res) => {
    const { orderId } = req.params; // Use params, not query

    try {
      const order = await customerOrder.findById(orderId).select("documents"); // Ensure we only fetch documents
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }

      return res.status(200).json(order.documents); // Return documents array directly
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  paymentCheck = async (id) => {
    try {
      const order = await customerOrder.findById(id);
      if (order.payment_status === "unpaid") {
        await customerOrder.findByIdAndUpdate(id, {
          delivery_status: "cancelled",
        });
        await authOrderModel.updateMany(
          {
            orderId: id,
          },
          {
            delivery_status: "cancelled",
          }
        );
      }
      return true;
    } catch (error) {
      console.log(error);
    }
  };

  place_order = async (req, res) => {
    const { price, products, shipping_fee, shippingInfo, userId } = req.body;

    let authorOrderData = [];
    let cardId = [];
    const tempDate = moment(Date.now()).format("LLL");

    let customerOrderProduct = [];

    // Organize customer order products
    for (let i = 0; i < products.length; i++) {
      const pro = products[i].products;
      for (let j = 0; j < pro.length; j++) {
        let tempCusPro = pro[j].productInfo;
        tempCusPro.quantity = pro[j].quantity;
        customerOrderProduct.push(tempCusPro);
        if (pro[j]._id) {
          cardId.push(pro[j]._id);
        }
      }
    }

    try {
      // Create the order in the database
      const order = await customerOrder.create({
        customerId: userId,
        shippingInfo,
        products: customerOrderProduct,
        price: price + shipping_fee,
        delivery_status: "En attente",
        payment_status: "En attente",
        date: tempDate,
      });

      // Prepare seller-specific order data
      for (let i = 0; i < products.length; i++) {
        const pro = products[i].products;
        const pri = products[i].price;
        const sellerId = products[i].sellerId;
        let storePro = [];
        for (let j = 0; j < pro.length; j++) {
          let tempPro = pro[j].productInfo;
          tempPro.quantity = pro[j].quantity;
          storePro.push(tempPro);
        }

        authorOrderData.push({
          orderId: order.id,
          sellerId,
          products: storePro,
          price: pri,
          payment_status: "En attente",
          shippingInfo,
          delivery_status: "En attente",
          date: tempDate,
        });
      }
      await authOrderModel.insertMany(authorOrderData);

      // Remove items from cart
      for (let k = 0; k < cardId.length; k++) {
        await cardModel.findByIdAndDelete(cardId[k]);
      }

      // Email to Client
      const clientEmail = shippingInfo.email;
      const subjectClient = "Confirmation de commande - Fly Numedia";
      const titleClient = "Votre commande a été reçue avec succès";
      const descriptionClient = `Cher client(e) ${shippingInfo.name} ,<br/><br/> Merci pour votre commande ! Voici les détails : `;
      const details = {
        name: shippingInfo.name,
        email: clientEmail,
        phone: shippingInfo.phone,
        address: shippingInfo.address,
        price: order.price,
        orderId: order.id,
      };

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

      // Email to Admin
      const adminEmail = "work.flynumedia@gmail.com";
      const subjectAdmin = "Nouvelle commande - Fly Numedia";
      const titleAdmin = "Nouvelle commande reçue";
      const descriptionAdmin = `Une nouvelle commande a été passée. Voici les détails : `;

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

      // Fetch seller emails from the order products
      const sellerEmails = await Promise.all(
        Array.from(new Set(order.products.map((product) => product.sellerId)))
          .filter((sellerId) => sellerId) // Ensure valid sellerId
          .map(async (sellerId) => {
            const seller = await sellerModel.findById(sellerId);
            return seller ? seller.email : null;
          })
      );

      const uniqueSellerEmails = sellerEmails.filter((email) => email); // Remove null or undefined emails

      console.log("Seller Emails:", sellerEmails);

      // Email to Partners

      const subjectPartner = "Nouvelle commande - Fly Numedia";
      const titlePartner = "Une nouvelle commande est disponible";
      const descriptionPartner = `
          Une nouvelle commande a été passée par ${shippingInfo.name}. Voici les détails :
        `;

      await send_email({
        sellerEmails: uniqueSellerEmails,
        subject: subjectPartner,
        title: titlePartner,
        description: descriptionPartner,
        details: details,
        sendToAdmin: false,
        sendToClient: false,
        sendToPartner: true,
      });

      // Schedule payment status check
      setTimeout(() => {
        this.paymentCheck(order.id);
      }, 15000);

      // Response success
      responseReturn(res, 201, {
        message: "Commande passée avec succès, emails envoyés !",
        orderId: order.id,
      });
    } catch (error) {
      console.error("Error placing order:", error.message);
      responseReturn(res, 500, {
        message: "Échec de la passation de la commande",
      });
    }
  };

  get_customer_databorad_data = async (req, res) => {
    const { userId } = req.params;

    try {
      const recentOrders = await customerOrder
        .find({
          customerId: new ObjectId(userId),
        })
        .limit(5);
      const pendingOrder = await customerOrder
        .find({
          customerId: new ObjectId(userId),
          delivery_status: "En attente",
        })
        .countDocuments();
      const totalOrder = await customerOrder
        .find({
          customerId: new ObjectId(userId),
        })
        .countDocuments();
      const cancelledOrder = await customerOrder
        .find({
          customerId: new ObjectId(userId),
          delivery_status: "Annulé",
        })
        .countDocuments();
      responseReturn(res, 200, {
        recentOrders,
        pendingOrder,
        cancelledOrder,
        totalOrder,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  get_orders = async (req, res) => {
    const { customerId, status } = req.params;

    try {
      let orders = [];
      if (status !== "all") {
        orders = await customerOrder.find({
          customerId: new ObjectId(customerId),
          delivery_status: status,
        });
      } else {
        orders = await customerOrder.find({
          customerId: new ObjectId(customerId),
        });
      }
      responseReturn(res, 200, {
        orders,
      });
    } catch (error) {
      console.log(error.message);
    }
  };
  get_order = async (req, res) => {
    const { orderId } = req.params;

    try {
      const order = await customerOrder.findById(orderId);
      responseReturn(res, 200, {
        order,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  get_admin_orders = async (req, res) => {
    let { page, parPage, searchValue } = req.query;
    page = parseInt(page);
    parPage = parseInt(parPage);

    const skipPage = parPage * (page - 1);

    try {
      if (searchValue) {
      } else {
        const orders = await customerOrder
          .aggregate([
            {
              $lookup: {
                from: "authororders",
                localField: "_id",
                foreignField: "orderId",
                as: "suborder",
              },
            },
          ])
          .skip(skipPage)
          .limit(parPage)
          .sort({ createdAt: -1 });

        const totalOrder = await customerOrder.aggregate([
          {
            $lookup: {
              from: "authororders",
              localField: "_id",
              foreignField: "orderId",
              as: "suborder",
            },
          },
        ]);

        responseReturn(res, 200, { orders, totalOrder: totalOrder.length });
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  get_admin_order = async (req, res) => {
    const { orderId } = req.params;

    try {
      const order = await customerOrder.aggregate([
        {
          $match: { _id: new ObjectId(orderId) },
        },
        {
          $lookup: {
            from: "authororders",
            localField: "_id",
            foreignField: "orderId",
            as: "suborder",
          },
        },
      ]);
      responseReturn(res, 200, { order: order[0] });
    } catch (error) {
      console.log("get admin order " + error.message);
    }
  };

  admin_order_status_update = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
      await customerOrder.findByIdAndUpdate(orderId, {
        delivery_status: status,
      });
      responseReturn(res, 200, {
        message: "order status changed successfully",
      });
    } catch (error) {
      console.log("get admin order status error " + error.message);
      responseReturn(res, 500, { message: "internal server error" });
    }
  };

  get_seller_orders = async (req, res) => {
    const { sellerId } = req.params;
    let { page, parPage, searchValue } = req.query;
    page = parseInt(page);
    parPage = parseInt(parPage);

    const skipPage = parPage * (page - 1);

    try {
      if (searchValue) {
      } else {
        const orders = await authOrderModel
          .find({
            sellerId,
          })
          .skip(skipPage)
          .limit(parPage)
          .sort({ createdAt: -1 });
        const totalOrder = await authOrderModel
          .find({
            sellerId,
          })
          .countDocuments();
        responseReturn(res, 200, { orders, totalOrder });
      }
    } catch (error) {
      console.log("get seller order error " + error.message);
      responseReturn(res, 500, { message: "internal server error" });
    }
  };

  get_seller_order = async (req, res) => {
    const { orderId } = req.params;

    try {
      const order = await authOrderModel.findById(orderId);

      responseReturn(res, 200, { order });
    } catch (error) {
      console.log("get admin order " + error.message);
    }
  };

  seller_order_status_update = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
      await authOrderModel.findByIdAndUpdate(orderId, {
        delivery_status: status,
      });
      responseReturn(res, 200, {
        message: "order status changed successfully",
      });
    } catch (error) {
      console.log("get admin order status error " + error.message);
      responseReturn(res, 500, { message: "internal server error" });
    }
  };

  create_payment = async (req, res) => {
    const { price } = req.body;

    try {
      const payment = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      responseReturn(res, 200, { clientSecret: payment.client_secret });
    } catch (error) {
      console.log(error.message);
    }
  };

  order_confirm = async (req, res) => {
    const { orderId } = req.params;
    try {
      await customerOrder.findByIdAndUpdate(orderId, {
        payment_status: "paid",
        delivery_status: "pending",
      });
      await authOrderModel.updateMany(
        { orderId: new ObjectId(orderId) },
        {
          payment_status: "paid",
          delivery_status: "pending",
        }
      );
      const cuOrder = await customerOrder.findById(orderId);

      const auOrder = await authOrderModel.find({
        orderId: new ObjectId(orderId),
      });

      const time = moment(Date.now()).format("l");

      const splitTime = time.split("/");

      await myShopWallet.create({
        amount: cuOrder.price,
        manth: splitTime[0],
        year: splitTime[2],
      });

      for (let i = 0; i < auOrder.length; i++) {
        await sellerWallet.create({
          sellerId: auOrder[i].sellerId.toString(),
          amount: auOrder[i].price,
          manth: splitTime[0],
          year: splitTime[2],
        });
      }

      responseReturn(res, 200, { message: "success" });
    } catch (error) {
      console.log(error.message);
    }
  };
}

module.exports = new orderController();
