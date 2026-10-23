const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  salonId: { type: String, required: true, index: true },
  refundId: { type: String, required: true },
  customer: { type: String, required: true },
  service: { type: String, required: true },
  amount: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: "Pending" }, // "Pending", "Approved", "Rejected"
  avatar: { type: String, default: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&q=80" }
}, { timestamps: true });

refundSchema.index({ salonId: 1, refundId: 1 }, { unique: true });
module.exports = mongoose.model('Refund', refundSchema);