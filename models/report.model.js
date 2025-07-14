const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportNumber: {
    type: String,
    required: [true, 'Report number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return v.startsWith('WO');
      },
      message: props => `Report number must start with "WO"`
    }
  },
  vnNumber: {
    type: String,
    required: [true, 'VN number is required'],
    trim: true
  },
  files: [{
    originalName: String,
    path: String,
    mimeType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  adminNote: {
    type: String,
    trim: true
  },
  partnerNote: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Rejected', 'Completed'],
    default: 'Active'
  },
  isNew: {
    type: Boolean,
    default: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  }
}, {
  timestamps: true
});

const Report = mongoose.model('Report', reportSchema);
module.exports = Report; 