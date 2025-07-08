const Unit = require('../models/unit.model');
const Customer = require('../models/customer.model');
const Report = require('../models/report.model');

// Get all units
exports.getAllUnits = async (req, res) => {
  try {
    const units = await Unit.find()
      .populate('customerId', 'name email');

    res.json(units);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get units for specific customer
exports.getCustomerUnits = async (req, res) => {
  try {
    const customerId = req.params.customerId;

    // Verify the customer exists
    const customer = await Customer.findById(customerId).populate('partnerId');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check authorization
    if (req.role === 'partner') {
      // Partners can only access their own customers' units
      if (customer.partnerId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access these units' });
      }
    } else if (req.role === 'admin') {
      // Admins can only access units of customers under their partners
      if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access these units' });
      }
    }

    const units = await Unit.find({ customerId })
      .select('_id unitName customerId')
      .lean();

    res.json(units);
  } catch (error) {
    console.error('Error fetching customer units:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create new unit
exports.createUnit = async (req, res) => {
  try {
    const { unitName, customerId } = req.body;

    // Check if the customer exists and belongs to a partner managed by the admin
    const customer = await Customer.findById(customerId)
      .populate('partnerId');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const unit = await Unit.create({
      unitName,
      customerId
    });

    res.status(201).json({
      message: 'Unit created successfully',
      unit: await unit.populate('customerId', 'name email')
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update unit
exports.updateUnit = async (req, res) => {
  try {
    const { unitName, customerId } = req.body;
    const unit = await Unit.findById(req.params.id)
      .populate({
        path: 'customerId',
        populate: {
          path: 'partnerId'
        }
      });

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check if the unit's customer's partner belongs to the admin
    if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If customerId is being changed, verify the new customer
    if (customerId && customerId !== unit.customerId._id.toString()) {
      const newCustomer = await Customer.findById(customerId).populate('partnerId');
      if (!newCustomer) {
        return res.status(404).json({ message: 'New customer not found' });
      }
      
      // Check if the new customer belongs to a partner managed by the admin
      if (newCustomer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign unit to this customer' });
      }
      
      unit.customerId = customerId;
    }

    unit.unitName = unitName || unit.unitName;
    await unit.save();

    res.json({
      message: 'Unit updated successfully',
      unit: await unit.populate('customerId', 'name email')
    });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete unit and all associated reports
exports.deleteUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id)
      .populate({
        path: 'customerId',
        populate: {
          path: 'partnerId'
        }
      });

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check if the unit's customer's partner belongs to the admin
    if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete all reports associated with this unit
    await Report.deleteMany({ unitId: unit._id });

    // Finally delete the unit
    await Unit.deleteOne({ _id: unit._id });

    res.json({ message: 'Unit and all associated reports deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single unit by ID
exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id)
      .populate({
        path: 'customerId',
        select: 'name email partnerId',
        populate: {
          path: 'partnerId',
          select: 'name email adminId'
        }
      })
      .lean();

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check authorization
    if (req.role === 'partner') {
      // Partners can only access their own customers' units
      if (unit.customerId.partnerId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access this unit' });
      }
    } else if (req.role === 'admin') {
      // Admins can only access units of customers under their partners
      if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access this unit' });
      }
    }

    // Get all reports for this unit
    const reports = await Report.find({ unitId: unit._id })
      .select('reportNumber vnNumber status createdAt')
      .sort('-createdAt')
      .lean();

    // Add reports to unit object
    unit.reports = reports;
    unit.createdAt = unit._id.getTimestamp(); // Get creation date from _id

    res.json(unit);
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ message: error.message });
  }
}; 