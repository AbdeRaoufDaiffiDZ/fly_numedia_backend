const mongoose = require("mongoose");
mongoose.set("debug", true);
module.exports.dbConnect = async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true, // Add this option as well
      serverSelectionTimeoutMS: 5000, // Optional: Limits how long mongoose will wait for MongoDB to respond (in milliseconds)
    });
    console.log("Database connected....");
  } catch (error) {
    console.log("Error connecting to the database: ", error.message);
  }
};
