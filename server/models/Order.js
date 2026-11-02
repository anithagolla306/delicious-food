
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  items: [{
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  customerName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["Placed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"],
    default: "Placed"
  }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
