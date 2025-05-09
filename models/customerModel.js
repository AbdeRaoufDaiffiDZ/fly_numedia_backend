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
    role: {
      type: String,
      default: 'customer'
  }
  },
  { timestamps: true }
);

module.exports = model("customers", customerSchema);
