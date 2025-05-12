const { Schema, model } = require("mongoose");

const customerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    resetCode: {
      type: String,
      select: false,
    },
    resetCodeExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = model("customers", customerSchema);
