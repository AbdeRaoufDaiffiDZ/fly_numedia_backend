const categoryModel = require("../../models/categoryModel");
const productModel = require("../../models/productModel");
const queryProducts = require("../../utiles/queryProducts");
const reviewModel = require("../../models/reviewModel");
const axios = require("axios");

const moment = require("moment");
const {
  mongo: { ObjectId },
} = require("mongoose");

const { responseReturn } = require("../../utiles/response");
const sellerModel = require("../../models/sellerModel");
class homeControllers {
  formateProduct = (products) => {
    return products; // Return the products array without grouping
  };
  get_categorys = async (req, res) => {
    try {
      console.log("get home categorys req");
      const categorys = await categoryModel.find({});
      responseReturn(res, 200, {
        categorys,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  get_products = async (req, res) => {
    try {
      // Filter products where `isDeleted` is "Disponible"
      const products = await productModel
        .find({ isDeleted: "Disponible" })
        .limit(16)
        .sort({ createdAt: -1 });

      const allProduct1 = await productModel
        .find({ isDeleted: "Disponible" })
        .limit(9)
        .sort({ createdAt: -1 });
      const latest_product = this.formateProduct(allProduct1);

      const allProduct2 = await productModel
        .find({ isDeleted: "Disponible" })
        .limit(9)
        .sort({ rating: -1 });
      const topRated_product = this.formateProduct(allProduct2);

      const allProduct3 = await productModel
        .find({ isDeleted: "Disponible" })
        .limit(9)
        .sort({ discount: -1 });
      const discount_product = this.formateProduct(allProduct3);

      // Respond with filtered products
      responseReturn(res, 200, {
        products,
        latest_product,
        topRated_product,
        discount_product,
      });
    } catch (error) {
      console.error("Error fetching products:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  };

  get_products_Old = async (req, res) => {
    try {
      const products = await productModel.find({}).limit(16).sort({
        createdAt: -1,
      });
      const allProduct1 = await productModel.find({}).limit(9).sort({
        createdAt: -1,
      });
      const latest_product = this.formateProduct(allProduct1);
      const allProduct2 = await productModel.find({}).limit(9).sort({
        rating: -1,
      });
      const topRated_product = this.formateProduct(allProduct2);
      const allProduct3 = await productModel.find({}).limit(9).sort({
        discount: -1,
      });
      const discount_product = this.formateProduct(allProduct3);

      responseReturn(res, 200, {
        products,
        latest_product,
        topRated_product,
        discount_product,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  get_product = async (req, res) => {
    const { slug } = req.params;
    try {
      console.log(slug);
      const product = await productModel.findOne({
        slug,
      });
      const relatedProducts = await productModel
        .find({
          $and: [
            {
              _id: {
                $ne: product.id,
              },
            },
            {
              category: {
                $eq: product.category,
              },
            },
          ],
        })
        .limit(20);
      const moreProducts = await productModel
        .find({
          $and: [
            {
              _id: {
                $ne: product.id,
              },
            },
            {
              sellerId: {
                $eq: product.sellerId,
              },
            },
          ],
        })
        .limit(3);
      responseReturn(res, 200, {
        product,
        relatedProducts,
        moreProducts,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  get_active_guides = async (req, res) => {
    try {
      // Query the database to find users with role "guide" and status "active"
      const guides = await sellerModel
        .find({ role: "guide", status: "active" })
        .sort({ createdAt: -1 });

      // Send the response with the retrieved guides
      responseReturn(res, 200, { guides });
    } catch (error) {
      console.log("Error fetching active guides: " + error.message);
      responseReturn(res, 500, { error: "Failed to retrieve guides" });
    }
  };

  price_range_product = async (req, res) => {
    try {
      const {
        minPrice = 0,
        maxPrice = Number.MAX_SAFE_INTEGER,
        page = 1,
        limit = 20,
      } = req.query;

      // Validate price range
      const priceRange = {
        low: parseFloat(minPrice),
        high: parseFloat(maxPrice),
      };

      if (
        isNaN(priceRange.low) ||
        isNaN(priceRange.high) ||
        priceRange.low > priceRange.high
      ) {
        return responseReturn(res, 400, { error: "Invalid price range" });
      }

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Query products within price range
      const query = {
        price: {
          $gte: priceRange.low,
          $lte: priceRange.high,
        },
      };

      // Get products with pagination
      const products = await productModel
        .find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

      // Format products (return flat list)
      const formattedProducts = products; // Simply return the products array as is

      // Get total count for pagination
      const totalProducts = await productModel.countDocuments(query);

      // Get actual price range from database
      const priceStats = await productModel.aggregate([
        {
          $group: {
            _id: null,
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
          },
        },
      ]);

      const availablePriceRange =
        priceStats.length > 0
          ? {
              low: priceStats[0].minPrice,
              high: priceStats[0].maxPrice,
            }
          : { low: 0, high: 0 };

      responseReturn(res, 200, {
        products: formattedProducts,
        priceRange: availablePriceRange,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
          hasMore: skip + products.length < totalProducts,
        },
      });
    } catch (error) {
      console.error(error.message);
      responseReturn(res, 500, { error: "Server error" });
    }
  };

  query_products = async (req, res) => {
    const parPage = 12;
    req.query.parPage = parPage;
    try {
      console.log("req to filter products");
      const products = await productModel.find({}).sort({
        createdAt: -1,
      });
      const totalProduct = new queryProducts(products, req.query)
        .categoryQuery()
        .searchQuery()
        .priceQuery()
        .ratingQuery()
        .sortByPrice()
        .countProducts();

      const result = new queryProducts(products, req.query)
        .categoryQuery()
        .searchQuery()
        .ratingQuery()
        .priceQuery()
        .sortByPrice()
        .skip()
        .limit()
        .getProducts();

      responseReturn(res, 200, {
        products: result,
        totalProduct,
        parPage,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  // query_products = async (req, res) => {
  //   const parPage = 12;
  //   const page = parseInt(req.query.page) || 1;

  //   try {
  //     const filterConditions = [];

  //     // Price filter
  //     const minPrice = parseFloat(req.query.minPrice);
  //     const maxPrice = parseFloat(req.query.maxPrice);
  //     if (!isNaN(minPrice) && !isNaN(maxPrice)) {
  //       filterConditions.push({ price: { $gte: minPrice, $lte: maxPrice } });
  //     }

  //     // Category filter
  //     if (req.query.category && req.query.category.trim() !== "") {
  //       filterConditions.push({ category: req.query.category.trim() });
  //     }

  //     // Rating filter
  //     const minRating = parseFloat(req.query.rating);
  //     if (!isNaN(minRating) && minRating > 0) {
  //       filterConditions.push({ rating: { $gte: minRating } });
  //     }

  //     // Search filter
  //     if (req.query.searchValue && req.query.searchValue.trim() !== "") {
  //       filterConditions.push({ $text: { $search: req.query.searchValue.trim() } });
  //     }

  //     // Build the final query
  //     const query = filterConditions.length > 0 ? { $and: filterConditions } : {};

  //     // Build sort object
  //     let sortOption = { createdAt: -1 };
  //     if (req.query.sortPrice === 'low-to-high') {
  //       sortOption = { price: 1 };
  //     } else if (req.query.sortPrice === 'high-to-low') {
  //       sortOption = { price: -1 };
  //     }

  //     // Debug (only in development)
  //     if (process.env.NODE_ENV !== 'production') {
  //       console.log('MongoDB Query:', JSON.stringify(query, null, 2));
  //       console.log('Sort Option:', sortOption);
  //     }

  //     // Execute queries
  //     const totalProduct = await productModel.countDocuments(query);
  //     const products = await productModel
  //       .find(query)
  //       .sort(sortOption)
  //       .skip((page - 1) * parPage)
  //       .limit(parPage)
  //       .lean();

  //     return res.status(200).json({
  //       products,
  //       totalProduct,
  //       parPage,
  //     });

  //   } catch (error) {
  //     console.error('Error in query_products:', error.message);
  //     return res.status(500).json({ error: 'Internal server error' });
  //   }
  // };

  submit_review = async (req, res) => {
    const { name, rating, review, productId } = req.body;
    //console.log(req.body);
    try {
      await reviewModel.create({
        productId,
        name,
        rating,
        review,
        date: moment(Date.now()).format("LL"),
      });

      let rat = 0;
      const reviews = await reviewModel.find({
        productId,
      });
      for (let i = 0; i < reviews.length; i++) {
        rat = rat + reviews[i].rating;
      }
      let productRating = 0;

      if (reviews.length !== 0) {
        productRating = (rat / reviews.length).toFixed(1);
      }

      await productModel.findByIdAndUpdate(productId, {
        rating: productRating,
      });

      responseReturn(res, 201, {
        message: "Review Success",
      });
    } catch (error) {
      console.log(error);
    }
  };

  get_reviews = async (req, res) => {
    const { productId } = req.params;
    let { pageNo } = req.query;
    pageNo = parseInt(pageNo);
    const limit = 5;
    const skipPage = limit * (pageNo - 1);
    try {
      let getRating = await reviewModel.aggregate([
        {
          $match: {
            productId: {
              $eq: new ObjectId(productId),
            },
            rating: {
              $not: {
                $size: 0,
              },
            },
          },
        },
        {
          $unwind: "$rating",
        },
        {
          $group: {
            _id: "$rating",
            count: {
              $sum: 1,
            },
          },
        },
      ]);
      let rating_review = [
        {
          rating: 5,
          sum: 0,
        },
        {
          rating: 4,
          sum: 0,
        },
        {
          rating: 3,
          sum: 0,
        },
        {
          rating: 2,
          sum: 0,
        },
        {
          rating: 1,
          sum: 0,
        },
      ];
      for (let i = 0; i < rating_review.length; i++) {
        for (let j = 0; j < getRating.length; j++) {
          if (rating_review[i].rating === getRating[j]._id) {
            rating_review[i].sum = getRating[j].count;
            break;
          }
        }
      }
      const getAll = await reviewModel.find({
        productId,
      });
      const reviews = await reviewModel
        .find({
          productId,
        })
        .skip(skipPage)
        .limit(limit)
        .sort({
          createdAt: -1,
        });
      responseReturn(res, 200, {
        reviews,
        totalReview: getAll.length,
        rating_review,
      });
    } catch (error) {
      console.log(error);
    }
  };
  //   chatBoot = async (req, res) => {
  //     try {
  //       // Extract the message from the request body
  //       const { message } = req.body;

  //       // Validate the message
  //       if (!message || typeof message !== 'string') {
  //         return res.status(400).json({
  //           error: 'Invalid or missing message field',
  //         });
  //       }

  //       // Create the response object
  //       const response = {
  //         message, // Echo the input message
  //         response: message, // Return the same message as the bot's response
  //         timestamp: new Date().toISOString(), // Current time in ISO 8601 format
  //       };

  //       // Send the response
  //       res.status(200).json(response);
  //     } catch (error) {
  //       // Handle unexpected errors
  //       console.error('Error in chatBot:', error);
  //       res.status(500).json({
  //         error: 'Internal server error',
  //         details: error.message,
  //       });
  //     }
  //   };

  chatBoot = async (req, res) => {
    try {
      // Extract and validate question
      const { query } = req.body;
      console.log("message to booot ")
      console.log(query);
      if (!query || typeof query !== "string") {
        return res.status(400).json({
          error: "Invalid or missing query field",
        });
      }

      // Configure Python API URL
      const AI_chatApiUrl = process.env.AI_CHAT_API_URL || "https://numedia-fly.onrender.com/chat";
      // Send request to Python API
      const response = await fetch(AI_chatApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }), // Use 'question' for Python API
      });

      // Parse response
      const data = await response.json();
      console.log(data);
      if (response.ok) {
        // Validate response structure
        if (!data.human_response) {
          throw new Error(
            "Invalid response from Python API: missing answer field"
          );
        }
        // Map Python response to Flutter format
        const answer = {
          message:data.human_response, // Original user input
          response: data.tool_response, // Python API's answer
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(answer);
      } else {
        // Log and return error
        console.error("Python API error:", {
          status: response.status,
          statusText: response.statusText,
          error: data.error || "Unknown error",
          details: data.details || "No details provided",
          requestBody: req.body,
        });
        return res.status(response.status).json({
          error: "Python API error",
          details: data.error || "Failed to process request",
        });
      }
    } catch (error) {
      // Handle network or unexpected errors
      console.error("Error in chatBoot:", {
        message: error.message,
        stack: error.stack,
        requestBody: req.body,
      });
      res.status(500).json({
        error: "Failed to process message",
        details: error.message,
      });
    }
  };

  flight_offers = async (req, res) => {
    try {
      // Extract and validate query parameters
      const {
        originLocationCode,
        destinationLocationCode,
        departureDate,
        returnDate,
        adults = 2,
        max = 5,
      } = req.query;

      if (!originLocationCode || !destinationLocationCode || !departureDate) {
        return res.status(400).json({
          error: "Missing required query parameters",
          details:
            "originLocationCode, destinationLocationCode, and departureDate are required",
        });
      }

      // Validate parameter types and formats
      if (
        typeof originLocationCode !== "string" ||
        typeof destinationLocationCode !== "string" ||
        typeof departureDate !== "string" ||
        (returnDate && typeof returnDate !== "string") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(departureDate) ||
        (returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate))
      ) {
        return res.status(400).json({
          error: "Invalid query parameter format",
          details:
            "Ensure location codes are strings and dates are in YYYY-MM-DD format",
        });
      }

      if (isNaN(adults) || adults < 1 || isNaN(max) || max < 1) {
        return res.status(400).json({
          error: "Invalid query parameter values",
          details: "adults and max must be positive integers",
        });
      }

      // Retrieve Amadeus API token
      const tokenUrl = process.env.TOKEN_URL;
      const clientId = process.env.AMADEUS_CLIENT_ID;
      const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return res.status(500).json({
          error: "Server configuration error",
          details: "Amadeus API credentials are missing",
        });
      }

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error("Amadeus token error:", {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: tokenData.error || "Unknown error",
          details: tokenData.error_description || "No details provided",
        });
        return res.status(500).json({
          error: "Failed to authenticate with Amadeus API",
          details: tokenData.error_description || "Authentication error",
        });
      }

      // Construct Amadeus API URL
      const queryParams = new URLSearchParams({
        originLocationCode,
        destinationLocationCode,
        departureDate,
        adults: adults.toString(),
        max: max.toString(),
      });

      if (returnDate) {
        queryParams.append("returnDate", returnDate);
      }

      const amadeusApiUrl = `https://test.api.amadeus.com/v2/shopping/flight-offers?${queryParams.toString()}`;

      // Send request to Amadeus API
      const flightResponse = await fetch(amadeusApiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const flightData = await flightResponse.json();

      if (flightResponse.ok) {
        // Map response to desired format
        const response = {
          data: flightData.data || [],
          meta: flightData.meta || {},
          timestamp: new Date().toISOString(),
        };
        res.status(200).json(response);
      } else {
        // Log and return error
        console.error("Amadeus API error:", {
          status: flightResponse.status,
          statusText: flightResponse.statusText,
          error: flightData.error || "Unknown error",
          details: flightData.error_description || "No details provided",
          requestQuery: req.query,
        });
        return res.status(flightResponse.status).json({
          error: "Amadeus API error",
          details:
            flightData.error_description || "Failed to fetch flight offers",
        });
      }
    } catch (error) {
      // Handle network or unexpected errors
      console.error("Error in flight_offers:", {
        message: error.message,
        stack: error.stack,
        requestQuery: req.query,
      });
      res.status(500).json({
        error: "Failed to process flight offers request",
        details: error.message,
      });
    }
  };
}
module.exports = new homeControllers();
