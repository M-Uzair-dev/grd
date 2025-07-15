const Unit = require('../models/unit.model');
const Customer = require('../models/customer.model');
const Partner = require('../models/partner.model');
const Report = require('../models/report.model');

// Get all units
exports.getAllUnits = async (req, res) => {
  try {
    const units = await Unit.find()
      .populate('customerId', 'name email')
      .populate('partnerId', 'name email');

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

// Get units for specific partner
exports.getPartnerUnits = async (req, res) => {
  try {
    const partnerId = req.params.partnerId;

    // Verify the partner exists
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Check authorization
    if (req.role === 'partner') {
      // Partners can only access their own units
      if (partner._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access these units' });
      }
    } else if (req.role === 'admin') {
      // Admins can only access units of their partners
      if (partner.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access these units' });
      }
    }

    const units = await Unit.find({ partnerId })
      .select('_id unitName partnerId')
      .lean();

    res.json(units);
  } catch (error) {
    console.error('Error fetching partner units:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create new unit
exports.createUnit = async (req, res) => {
  try {
    const { unitName, customerId, partnerId } = req.body;

    // Validate that either customerId or partnerId is provided, but not both
    if (!customerId && !partnerId) {
      return res.status(400).json({ message: 'Either customerId or partnerId must be provided' });
    }
    if (customerId && partnerId) {
      return res.status(400).json({ message: 'Unit cannot be associated with both customer and partner' });
    }

    let unit;
    if (customerId) {
      // Check if the customer exists and belongs to a partner managed by the admin
      const customer = await Customer.findById(customerId)
        .populate('partnerId');
      
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      unit = await Unit.create({
        unitName,
        customerId
      });

      res.status(201).json({
        message: 'Unit created successfully',
        unit: await unit.populate('customerId', 'name email')
      });
    } else {
      // Check if the partner exists and belongs to the admin
      const partner = await Partner.findById(partnerId);
      
      if (!partner) {
        return res.status(404).json({ message: 'Partner not found' });
      }

      if (partner.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }

      unit = await Unit.create({
        unitName,
        partnerId
      });

      res.status(201).json({
        message: 'Unit created successfully',
        unit: await unit.populate('partnerId', 'name email')
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update unit
exports.updateUnit = async (req, res) => {
  try {
    const { unitName, customerId, partnerId } = req.body;
    const unit = await Unit.findById(req.params.id)
      .populate({
        path: 'customerId',
        populate: {
          path: 'partnerId'
        }
      })
      .populate('partnerId');

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check authorization based on current unit association
    if (unit.customerId) {
      if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    } else if (unit.partnerId) {
      if (unit.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    // Handle changing association
    if (customerId && partnerId) {
      // Both customerId and partnerId provided - assign to customer under the partner
      const newCustomer = await Customer.findById(customerId).populate('partnerId');
      if (!newCustomer) {
        return res.status(404).json({ message: 'New customer not found' });
      }
      
      if (newCustomer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign unit to this customer' });
      }
      
      // Verify the customer belongs to the selected partner
      if (newCustomer.partnerId._id.toString() !== partnerId) {
        return res.status(400).json({ message: 'Selected customer does not belong to the selected partner' });
      }
      
      unit.customerId = customerId;
      unit.partnerId = null; // Remove direct partner association since unit is now under customer
    } else if (customerId && customerId !== unit.customerId?._id.toString()) {
      // Only customerId provided - assign to customer
      const newCustomer = await Customer.findById(customerId).populate('partnerId');
      if (!newCustomer) {
        return res.status(404).json({ message: 'New customer not found' });
      }
      
      if (newCustomer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign unit to this customer' });
      }
      
      unit.customerId = customerId;
      unit.partnerId = null; // Remove partner association
    } else if (partnerId && partnerId !== unit.partnerId?._id.toString()) {
      // Only partnerId provided - assign directly to partner
      const newPartner = await Partner.findById(partnerId);
      if (!newPartner) {
        return res.status(404).json({ message: 'New partner not found' });
      }
      
      if (newPartner.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign unit to this partner' });
      }
      
      unit.partnerId = partnerId;
      unit.customerId = null; // Remove customer association
    }

    unit.unitName = unitName || unit.unitName;
    await unit.save();

    // Populate the appropriate association for response
    if (unit.customerId) {
      res.json({
        message: 'Unit updated successfully',
        unit: await unit.populate('customerId', 'name email')
      });
    } else {
      res.json({
        message: 'Unit updated successfully',
        unit: await unit.populate('partnerId', 'name email')
      });
    }
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
      })
      .populate('partnerId');

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check authorization based on unit association
    if (unit.customerId) {
      if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    } else if (unit.partnerId) {
      if (unit.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
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
      .populate({
        path: 'partnerId',
        select: 'name email adminId'
      })
      .lean();

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    // Check authorization
    if (req.role === 'partner') {
      if (unit.customerId) {
        // Partners can only access their own customers' units
        if (unit.customerId.partnerId._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to access this unit' });
        }
      } else if (unit.partnerId) {
        // Partners can only access their own units
        if (unit.partnerId._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to access this unit' });
        }
      }
    } else if (req.role === 'admin') {
      if (unit.customerId) {
        // Admins can only access units of customers under their partners
        if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to access this unit' });
        }
      } else if (unit.partnerId) {
        // Admins can only access units of their partners
        if (unit.partnerId.adminId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to access this unit' });
        }
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