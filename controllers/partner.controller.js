const Partner = require('../models/partner.model');
const Customer = require('../models/customer.model');
const Unit = require('../models/unit.model');
const Report = require('../models/report.model');

// Get all partners with full info (except password)
exports.getAllPartners = async (req, res) => {
  try {
    const partners = await Partner.find()
      .select('-password')
      .populate('adminId', 'name email');

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all partners with nested data (names only)
exports.getAllPartnersNested = async (req, res) => {
  try {
    const partners = await Partner.find({ adminId: req.user._id })
      .select('name _id')
      .lean();

    // For each partner, get their customers
    for (let partner of partners) {
      const customers = await Customer.find({ partnerId: partner._id })
        .select('name _id')
        .lean();

      // For each customer, get their units and direct reports
      for (let customer of customers) {
        const units = await Unit.find({ customerId: customer._id })
          .select('unitName _id')
          .lean();

        // For each unit, get its reports
        for (let unit of units) {
          const unitReports = await Report.find({ unitId: unit._id })
            .select('reportNumber vnNumber _id')
            .lean();
          unit.reports = unitReports;
        }

        // Get reports directly linked to customer (no unit)
        const customerReports = await Report.find({ 
          customerId: customer._id,
          $or: [
            { unitId: null },
            { unitId: { $exists: false } }
          ]
        })
          .select('reportNumber vnNumber _id')
          .lean();

        customer.units = units;
        customer.reports = customerReports;
      }

      partner.customers = customers;
    }

    res.json(partners);
  } catch (error) {
    console.error('Error fetching nested data:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get partners for specific admin
exports.getAdminPartners = async (req, res) => {
  try {
    const partners = await Partner.find({ adminId: req.user._id })
      .select('-password')
      .populate('adminId', 'name email');

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single partner by ID
exports.getPartnerById = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }
    res.json(partner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new partner
exports.createPartner = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const partner = await Partner.create({
      name,
      email,
      password,
      adminId: req.user._id
    });

    res.status(201).json({
      message: 'Partner created successfully',
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        adminId: partner.adminId
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update partner
exports.updatePartner = async (req, res) => {
  try {
    const { name, email } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    partner.name = name || partner.name;
    partner.email = email || partner.email;

    await partner.save();

    res.json({
      message: 'Partner updated successfully',
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        adminId: partner.adminId
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update partner password
exports.updatePartnerPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    partner.password = password;
    await partner.save();

    res.json({ message: 'Partner password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete partner and all associated data
exports.deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    try {
      // Get all customers of this partner
      const customers = await Customer.find({ partnerId: partner._id });
      
      // Delete all units and reports for each customer
      for (let customer of customers) {
        // Get all units of this customer
        const units = await Unit.find({ customerId: customer._id });
        
        // Delete all reports associated with units
        for (let unit of units) {
          await Report.deleteMany({ unitId: unit._id });
        }
        
        // Delete all units
        await Unit.deleteMany({ customerId: customer._id });
        
        // Delete all direct reports (not associated with units)
        await Report.deleteMany({ 
          customerId: customer._id,
          unitId: { $exists: false }
        });
      }

      // Delete all customers
      await Customer.deleteMany({ partnerId: partner._id });

      // Finally delete the partner
      await Partner.deleteOne({ _id: partner._id });

      res.json({ message: 'Partner and all associated data deleted successfully' });
    } catch (deleteError) {
      console.error('Delete operation error:', deleteError);
      return res.status(500).json({ message: 'Failed to delete partner data. Please try again.' });
    }
  } catch (error) {
    console.error('Partner deletion error:', error);
    res.status(500).json({ message: error.message || 'Failed to process delete request' });
  }
}; 