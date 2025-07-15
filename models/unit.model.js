const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  unitName: {
    type: String,
    required: [true, 'Unit name is required'],
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reports
unitSchema.virtual('reports', {
  ref: 'Report',
  localField: '_id',
  foreignField: 'unitId'
});

// Ensure either customerId or partnerId is provided, but not both
unitSchema.pre('save', function(next) {
  if (!this.customerId && !this.partnerId) {
    return next(new Error('Unit must be associated with either a customer or a partner'));
  }
  if (this.customerId && this.partnerId) {
    return next(new Error('Unit cannot be associated with both a customer and a partner'));
  }
  next();
});

const Unit = mongoose.model('Unit', unitSchema);
module.exports = Unit; 