const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  salonId: { type: String, required: true, index: true },
  code: { type: String, required: true },
  discountPercentage: { type: Number, required: true },
  validTill: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ salonId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Coupon', couponSchema);