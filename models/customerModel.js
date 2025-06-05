const { Schema, model } = require("mongoose");

const customerSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: String,
      required: false,
    },
    nationality: {
      type: String,
      required: false,
    },
    sex: {
      type: String,
      required: false,
    },
    passportNumber: {
      type: String,
      required: false,
    },
    passportExpirationDate: {
      type: String,
      required: false,
    },
    profilePictureUrl: {
      type: String,
      required: false,
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
    role: {
      type: String,
      default: 'customer'
    }
  },
  { timestamps: true }
);

module.exports = model("customers", customerSchema);
