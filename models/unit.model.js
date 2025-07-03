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
    required: true
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

const Unit = mongoose.model('Unit', unitSchema);
module.exports = Unit; 