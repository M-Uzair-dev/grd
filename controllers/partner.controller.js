const Partner = require("../models/partner.model");
const Customer = require("../models/customer.model");
const Unit = require("../models/unit.model");
const Report = require("../models/report.model");


// Get all partners with full info (except password)
exports.getAllPartners = async (req, res) => {
  try {
    const partners = await Partner.find()
      .select("-password")
      .populate("adminId", "name email");

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get partner's nested data (for partner dashboard)
exports.getPartnerNested = async (req, res) => {
  try {
    const partner = await Partner.findById(req.user._id)
      .select("name _id")
      .lean();

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Get all customers for this partner
    const customers = await Customer.find({ partnerId: partner._id })
      .select("name _id")
      .lean();

    // For each customer, get their units and direct reports
    for (let customer of customers) {
      const units = await Unit.find({ customerId: customer._id })
        .select("unitName _id")
        .lean();

      // For each unit, get its reports
      for (let unit of units) {
        const unitReports = await Report.find({ unitId: unit._id })
          .select("reportNumber vnNumber status isNew _id")
          .lean();
        unit.reports = unitReports;
      }

      // Get reports directly linked to customer (no unit)
      const customerReports = await Report.find({
        customerId: customer._id,
        $or: [{ unitId: null }, { unitId: { $exists: false } }],
      })
        .select("reportNumber vnNumber status isNew _id")
        .lean();

      customer.units = units;
      customer.reports = customerReports;
    }

    // Get partner-level units
    const partnerUnits = await Unit.find({ partnerId: partner._id })
      .select("unitName _id")
      .lean();

    // For each partner unit, get its reports
    for (let unit of partnerUnits) {
      const unitReports = await Report.find({ unitId: unit._id })
        .select("reportNumber vnNumber status isNew _id")
        .lean();
      unit.reports = unitReports;
    }

    // Fetch reports directly under the partner (no customerId, no unitId)
    const partnerReports = await Report.find({
      partnerId: partner._id,
      $or: [{ customerId: null }, { customerId: { $exists: false } }],
      $or: [{ unitId: null }, { unitId: { $exists: false } }],
    })
      .select("reportNumber vnNumber isNew status _id")
      .lean();
    partner.reports = partnerReports;

    partner.customers = customers;
    partner.units = partnerUnits;
    res.json([partner]); // Return as array to match admin format
  } catch (error) {
    console.error("Error fetching partner nested data:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all partners with nested data (names only) - OPTIMIZED
exports.getAllPartnersNested = async (req, res) => {
  try {
    const result = await Partner.aggregate([
      // Match partners for this admin
      { $match: { adminId: req.user._id } },

      // Lookup customers
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "partnerId",
          as: "customers",
          pipeline: [{ $project: { name: 1, _id: 1, partnerId: 1 } }],
        },
      },

      // Lookup partner-level units
      {
        $lookup: {
          from: "units",
          localField: "_id",
          foreignField: "partnerId",
          as: "units",
          pipeline: [{ $project: { unitName: 1, _id: 1, partnerId: 1 } }],
        },
      },

      // Lookup partner-level reports (no customer, no unit)
      {
        $lookup: {
          from: "reports",
          let: { partnerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$partnerId", "$$partnerId"] },
                    {
                      $or: [
                        { $eq: ["$customerId", null] },
                        { $eq: [{ $type: "$customerId" }, "missing"] },
                      ],
                    },
                    {
                      $or: [
                        { $eq: ["$unitId", null] },
                        { $eq: [{ $type: "$unitId" }, "missing"] },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                reportNumber: 1,
                vnNumber: 1,
                isNew: 1,
                status: 1,
                _id: 1,
              },
            },
          ],
          as: "reports",
        },
      },

      // Project only needed fields
      { $project: { name: 1, _id: 1, customers: 1, units: 1, reports: 1 } },
    ]);

    // Now get all customer units and reports in batch queries
    const partnerIds = result.map((p) => p._id);
    const customerIds = result.flatMap((p) => p.customers.map((c) => c._id));
    const partnerUnitIds = result.flatMap((p) => p.units.map((u) => u._id));

    // Batch fetch customer units
    const customerUnits =
      customerIds.length > 0
        ? await Unit.find({
            customerId: { $in: customerIds },
          })
            .select("unitName _id customerId")
            .lean()
        : [];

    // Batch fetch all unit IDs for reports
    const allUnitIds = [...partnerUnitIds, ...customerUnits.map((u) => u._id)];

    // Batch fetch all reports
    const [unitReports, customerReports] = await Promise.all([
      // Unit reports
      allUnitIds.length > 0
        ? Report.find({
            unitId: { $in: allUnitIds },
          })
            .select("reportNumber vnNumber isNew _id unitId")
            .lean()
        : [],

      // Customer reports (direct, no unit)
      customerIds.length > 0
        ? Report.find({
            customerId: { $in: customerIds },
            $or: [{ unitId: null }, { unitId: { $exists: false } }],
          })
            .select("reportNumber vnNumber isNew _id customerId")
            .lean()
        : [],
    ]);

    // Organize data efficiently
    const unitReportsMap = new Map();
    unitReports.forEach((report) => {
      if (!unitReportsMap.has(report.unitId.toString())) {
        unitReportsMap.set(report.unitId.toString(), []);
      }
      unitReportsMap.get(report.unitId.toString()).push(report);
    });

    const customerReportsMap = new Map();
    customerReports.forEach((report) => {
      if (!customerReportsMap.has(report.customerId.toString())) {
        customerReportsMap.set(report.customerId.toString(), []);
      }
      customerReportsMap.get(report.customerId.toString()).push(report);
    });

    const customerUnitsMap = new Map();
    customerUnits.forEach((unit) => {
      if (!customerUnitsMap.has(unit.customerId.toString())) {
        customerUnitsMap.set(unit.customerId.toString(), []);
      }
      customerUnitsMap.get(unit.customerId.toString()).push({
        ...unit,
        reports: unitReportsMap.get(unit._id.toString()) || [],
      });
    });

    // Attach data to result
    result.forEach((partner) => {
      // Attach reports to partner units
      partner.units = partner.units.map((unit) => ({
        ...unit,
        reports: unitReportsMap.get(unit._id.toString()) || [],
      }));

      // Attach units and reports to customers
      partner.customers = partner.customers.map((customer) => ({
        ...customer,
        units: customerUnitsMap.get(customer._id.toString()) || [],
        reports: customerReportsMap.get(customer._id.toString()) || [],
      }));
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching nested data:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get partners for specific admin
exports.getAdminPartners = async (req, res) => {
  try {
    const partners = await Partner.find({ adminId: req.user._id })
      .select("-password")
      .populate("adminId", "name email");

    res.json(partners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single partner by ID
exports.getPartnerById = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id).select("-password");
    console.log(partner);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }
    res.json(partner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new partner
exports.createPartner = async (req, res) => {
  try {
    const { name, email, password, personName, personContact } = req.body;

    const partner = await Partner.create({
      name,
      email,
      password,
      personName,
      personContact,
      adminId: req.user._id,
    });
    console.log(partner);

    res.status(201).json({
      message: "Partner created successfully",
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        personName: partner.personName,
        personContact: partner.personContact,
        adminId: partner.adminId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update partner
exports.updatePartner = async (req, res) => {
  try {
    const { name, email, personName, personContact } = req.body;
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    partner.name = name || partner.name;
    partner.email = email || partner.email;
    partner.personName = personName;
    partner.personContact = personContact;

    await partner.save();

    res.json({
      message: "Partner updated successfully",
      partner: {
        id: partner._id,
        name: partner.name,
        email: partner.email,
        personName: partner.personName,
        personContact: partner.personContact,
        adminId: partner.adminId,
      },
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
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    partner.password = password;
    await partner.save();

    res.json({ message: "Partner password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete partner and all associated data
exports.deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findById(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check if admin owns this partner
    if (partner.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
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
          unitId: { $exists: false },
        });
      }

      // Delete all customers
      await Customer.deleteMany({ partnerId: partner._id });

      // Finally delete the partner
      await Partner.deleteOne({ _id: partner._id });

      res.json({
        message: "Partner and all associated data deleted successfully",
      });
    } catch (deleteError) {
      console.error("Delete operation error:", deleteError);
      return res
        .status(500)
        .json({ message: "Failed to delete partner data. Please try again." });
    }
  } catch (error) {
    console.error("Partner deletion error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to process delete request" });
  }
};
