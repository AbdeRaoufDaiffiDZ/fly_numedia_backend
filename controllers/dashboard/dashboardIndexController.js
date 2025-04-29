const authorOrder = require("../../models/authOrder");
const customerOrder = require("../../models/customerOrder");
const sellerWallet = require("../../models/sellerWallet");
const myShopWallet = require("../../models/myShopWallet");
const sellerModel = require("../../models/sellerModel");
const customerModel = require("../../models/customerModel");

const adminSellerMessage = require("../../models/chat/adminSellerMessage");
const sellerCustomerMessage = require("../../models/chat/sellerCustomerMessage");
const productModel = require("../../models/productModel");

const {
  mongo: { ObjectId },
} = require("mongoose");
const { responseReturn } = require("../../utiles/response");

module.exports.get_seller_dashboard_data = async (req, res) => {
  const { id } = req;

  try {
    const totalSele = await sellerWallet.aggregate([
      {
        $match: {
          sellerId: {
            $eq: id,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalProduct = await productModel
      .find({
        sellerId: new ObjectId(id),
      })
      .countDocuments();

    const sellerTotalOrder = await authorOrder
      .find({
        sellerId: new ObjectId(id),
      })
      .countDocuments();

    const totalPendingOrder = await authorOrder
      .find({
        $and: [
          {
            sellerId: {
              $eq: new ObjectId(id),
            },
          },
          {
            delivery_status: {
              $eq: "pending",
            },
          },
        ],
      })
      .countDocuments();

    const messages = await sellerCustomerMessage
      .find({
        $or: [
          {
            senderId: {
              $eq: id,
            },
          },
          {
            receverId: {
              $eq: id,
            },
          },
        ],
      })
      .limit(3);

    const recentOrders = await authorOrder
      .find({
        sellerId: new ObjectId(id),
      })
      .limit(5);

    // Monthly Revenue
    const sellerMonthlyRevenue = await sellerWallet.aggregate([
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const revenueData = Array(12).fill(0);
    sellerMonthlyRevenue.forEach((item) => {
      revenueData[item._id.month - 1] = item.totalAmount / 10000;
    });

    const sellerMonthlyOrders = await authorOrder.aggregate([
      {
        $match: {
          sellerId: new ObjectId(id),
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map monthly orders to an array of 12 months
    const ordersData = Array(12).fill(0);
    sellerMonthlyOrders.forEach((item) => {
      ordersData[item._id - 1] = item.count;
    });

    const sellerMonthlyProducts = await productModel.aggregate([
      {
        $match: {
          sellerId: new ObjectId(id),
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map monthly products to an array of 12 months
    const productsData = Array(12).fill(0);
    sellerMonthlyProducts.forEach((item) => {
      productsData[item._id - 1] = item.count;
    });

    responseReturn(res, 200, {
      sellerTotalOrder,
      totalSale: totalSele.length > 0 ? totalSele[0].totalAmount : 0,
      totalPendingOrder,
      messages,
      recentOrders,
      totalProduct,
      sellerMonthlyOrders: ordersData,
      sellerMonthlyRevenue: revenueData,
      sellerMonthlyProducts: productsData,
    });
  } catch (error) {
    console.log("get seller dashboard data error " + error.messages);
  }
};

module.exports.get_admin_dashboard_data = async (req, res) => {
  const { id } = req;
  try {
    const totalSele = await myShopWallet.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalProduct = await productModel.find({}).countDocuments();

    const totalOrder = await customerOrder.find({}).countDocuments();

    const totalSeller = await sellerModel.find({}).countDocuments();

    const totalClient = await customerModel.find({}).countDocuments();

    const messages = await adminSellerMessage.find({}).limit(3);

    const recentOrders = await customerOrder.find({}).limit(5);

    // Monthly Revenue
    const monthlyRevenue = await myShopWallet.aggregate([
      {
        $group: {
          _id: { month: "$month", year: "$year" },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Map monthly revenue to an array of 12 months
    const revenueData = Array(12).fill(0);
    monthlyRevenue.forEach((item) => {
      revenueData[item._id.month - 1] = item.totalAmount / 10000;
    });

    // Monthly Orders
    const monthlyOrders = await customerOrder.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map monthly orders to an array of 12 months
    const ordersData = Array(12).fill(0);
    monthlyOrders.forEach((item) => {
      ordersData[item._id - 1] = item.count;
    });

    // Monthly Sellers
    const monthlySellers = await sellerModel.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map monthly sellers to an array of 12 months
    const sellersData = Array(12).fill(0);
    monthlySellers.forEach((item) => {
      sellersData[item._id - 1] = item.count;
    });

    responseReturn(res, 200, {
      totalOrder,
      totalSale: totalSele.length > 0 ? totalSele[0].totalAmount : 0,
      totalSeller,
      totalClient,
      messages,
      recentOrders,
      totalProduct,
      monthlyOrders: ordersData,
      monthlyRevenue: revenueData,
      monthlySellers: sellersData,
    });
  } catch (error) {
    console.log("get admin dashboard data error " + error.messages);
  }
};
