const mongoose = require("mongoose");
const uri = "mongodb+srv://raoufdaiffi:12345566@cluster0.xxgwbml.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

module.exports.dbConnect = () => {
  mongoose
    .connect(
      uri,{
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    )
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.error("Connection error", err);
    });
};
