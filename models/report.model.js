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
  pdfFile: {
    type: String,  // URL/path to the stored PDF
    required: [true, 'PDF file is required']
  },
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
    required: function() {
      return !this.unitId;
    }
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: function() {
      return !this.customerId;
    }
  }
}, {
  timestamps: true
});

// Middleware to ensure either unitId or customerId is present, but not both
reportSchema.pre('save', function(next) {
  if (this.unitId) {
    // If unitId is provided, ensure it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(this.unitId)) {
      this.unitId = null;
    }
  }

  // If no unitId is provided or it's invalid, ensure customerId is present
  if (!this.unitId && !this.customerId) {
    next(new Error('Either unitId or customerId must be provided'));
  }

  next();
});

const Report = mongoose.model('Report', reportSchema);
module.exports = Report; 