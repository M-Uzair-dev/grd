const Customer = require('../models/customer.model');
const Unit = require('../models/unit.model');
const Report = require('../models/report.model');
const Partner = require('../models/partner.model');

// Get all customers with full info
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate('partnerId', 'name email');

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all customers with nested data (names only)
exports.getAllCustomersNested = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select('name')
      .lean();

    // For each customer, get their units
    for (let customer of customers) {
      const units = await Unit.find({ customerId: customer._id })
        .select('unitName')
        .lean();

      // For each unit, get its reports
      for (let unit of units) {
        const unitReports = await Report.find({ unitId: unit._id })
          .select('reportNumber vnNumber')
          .lean();
        unit.reports = unitReports;
      }

      // Get reports directly linked to customer (no unit)
      const customerReports = await Report.find({ 
        customerId: customer._id,
        unitId: { $exists: false }
      })
        .select('reportNumber vnNumber')
        .lean();

      customer.units = units;
      customer.reports = customerReports;
    }

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get customers for specific partner
exports.getPartnerCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ partnerId: req.params.partnerId })
      .populate('partnerId', 'name email');

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('partnerId', 'name email adminId')
      .select('name email partnerId createdAt updatedAt');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check authorization
    if (req.role === 'partner') {
      // Partners can only access their own customers
      if (customer.partnerId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access this customer' });
      }
    } else if (req.role === 'admin') {
      // Admins can only access customers of their partners
      if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to access this customer' });
      }
    }

    res.json(customer);
  } catch (error) {
    console.error('Error in getCustomerById:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create new customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, email, partnerId } = req.body;

    // Check if the partner exists and belongs to the admin
    const partner = await Partner.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const customer = await Customer.create({
      name,
      email,
      partnerId
    });

    res.status(201).json({
      message: 'Customer created successfully',
      customer: await customer.populate('partnerId', 'name email')
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { name, email, partnerId } = req.body;
    const customer = await Customer.findById(req.params.id)
      .populate('partnerId');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if the customer's partner belongs to the admin
    if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If partnerId is being changed, verify the new partner
    if (partnerId && partnerId !== customer.partnerId._id.toString()) {
      const newPartner = await Partner.findById(partnerId);
      if (!newPartner) {
        return res.status(404).json({ message: 'New partner not found' });
      }

      // Check if the new partner belongs to the admin
      if (newPartner.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign customer to this partner' });
      }

      customer.partnerId = partnerId;
    }

    customer.name = name || customer.name;
    customer.email = email || customer.email;

    await customer.save();

    res.json({
      message: 'Customer updated successfully',
      customer: await customer.populate('partnerId', 'name email')
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete customer and all associated data
exports.deleteCustomer = async (req, res) => {
  try {
    // Check if the customer ID is valid
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid customer ID format' });
    }

    const customer = await Customer.findById(req.params.id)
      .populate('partnerId');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if partnerId exists and has adminId
    if (!customer.partnerId || !customer.partnerId.adminId) {
      return res.status(400).json({ message: 'Invalid partner data for this customer' });
    }

    // Check if the customer's partner belongs to the admin
    if (customer.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    try {
      // Delete all units of this customer
      await Unit.deleteMany({ customerId: customer._id });
      
      // Delete all reports of this customer (both direct and unit-related)
      await Report.deleteMany({ 
        $or: [
          { customerId: customer._id },
          { unitId: { $in: await Unit.find({ customerId: customer._id }).distinct('_id') } }
        ]
      });

      // Finally delete the customer
      await Customer.deleteOne({ _id: customer._id });

      res.json({ message: 'Customer and all associated data deleted successfully' });
    } catch (deleteError) {
      console.error('Delete operation error:', deleteError);
      return res.status(500).json({ message: 'Failed to delete customer data. Please try again.' });
    }
  } catch (error) {
    console.error('Customer deletion error:', error);
    res.status(500).json({ message: error.message || 'Failed to process delete request' });
  }
};

