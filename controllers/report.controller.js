const Report = require('../models/report.model');
const Unit = require('../models/unit.model');
const Customer = require('../models/customer.model');
const Partner = require('../models/partner.model');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/reports';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only PDF files
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('pdfFile');

// Get all reports
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('partnerId', 'name email')
      .populate('customerId', 'name email')
      .populate('unitId', 'unitName');

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get reports for specific partner
exports.getPartnerReports = async (req, res) => {
  try {
    const reports = await Report.find({ partnerId: req.user._id })
      .populate('partnerId', 'name email')
      .populate('customerId', 'name email')
      .populate('unitId', 'unitName');

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single report by ID
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('partnerId', 'name email')
      .populate('customerId', 'name email')
      .populate('unitId', 'unitName');
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

// Create new report
exports.createReport = async (req, res) => {
  try {
    // Handle file upload
    upload(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }

      const { 
        reportNumber, 
        vnNumber, 
        adminNote, 
        partnerId, 
        customerId, 
        unitId,
        status 
      } = req.body;

      // Basic validation
      if (!reportNumber || !vnNumber || !partnerId || !customerId || !req.file) {
        // Delete uploaded file if other validation fails
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: 'Missing required fields (Report Number, VN Number, Partner, Customer, and PDF File are required)' });
      }

      // Ensure report number has WO prefix
      const formattedReportNumber = reportNumber.startsWith('WO') ? reportNumber : `WO${reportNumber}`;

      // Create the report
      const report = await Report.create({
        reportNumber: formattedReportNumber,
        vnNumber,
        pdfFile: req.file.path, // Save the file path
        adminNote,
        partnerId,
        customerId,
        unitId,
        status
      });

      // Get partner email for notification
      const partner = await Partner.findById(partnerId);
      if (partner && partner.email) {
        // Send email to partner
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: partner.email,
          subject: 'New Report Available',
          html: `
            <h1>New Report Available</h1>
            <p>A new report has been created:</p>
            <p>Report Number: ${reportNumber}</p>
            <p>VN Number: ${vnNumber}</p>
            <p>Status: ${status}</p>
            <p>Admin Note: ${adminNote || 'No note provided'}</p>
          `
        };

        await transporter.sendMail(mailOptions);
      }

      res.status(201).json({
        message: 'Report created successfully',
        report: await report.populate([
          { path: 'partnerId', select: 'name email' },
          { path: 'customerId', select: 'name email' },
          { path: 'unitId', select: 'unitName' }
        ])
      });
    });
  } catch (error) {
    console.error('Report creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update report
exports.updateReport = async (req, res) => {
  try {
    const { 
      reportNumber, 
      vnNumber, 
      pdfFile, 
      adminNote, 
      status 
    } = req.body;

    const report = await Report.findById(req.params.id)
      .populate({
        path: 'partnerId',
        select: 'adminId'
      });

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if admin owns this report's partner
    if (report.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    report.reportNumber = reportNumber || report.reportNumber;
    report.vnNumber = vnNumber || report.vnNumber;
    report.pdfFile = pdfFile || report.pdfFile;
    report.adminNote = adminNote || report.adminNote;
    report.status = status || report.status;

    await report.save();

    res.json({
      message: 'Report updated successfully',
      report: await report.populate([
        { path: 'partnerId', select: 'name email' },
        { path: 'customerId', select: 'name email' },
        { path: 'unitId', select: 'unitName' }
      ])
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update partner note
exports.updatePartnerNote = async (req, res) => {
  try {
    const { partnerNote } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if partner owns this report
    if (report.partnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    report.partnerNote = partnerNote;
    await report.save();

    res.json({
      message: 'Partner note updated successfully',
      report: await report.populate([
        { path: 'partnerId', select: 'name email' },
        { path: 'customerId', select: 'name email' },
        { path: 'unitId', select: 'unitName' }
      ])
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Send report to customer
exports.sendReportToCustomer = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate([
        { path: 'partnerId', select: 'name email' },
        { path: 'customerId', select: 'name email' },
        { path: 'unitId', select: 'unitName' }
      ]);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if partner owns this report
    if (report.partnerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const customerEmail = report.customerId ? report.customerId.email : 
      (await Unit.findById(report.unitId).populate('customerId')).customerId.email;

    // Send email to customer
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: customerEmail,
      subject: `Report ${report.reportNumber} Available`,
      html: `
        <h1>Report Details</h1>
        <p>Report Number: ${report.reportNumber}</p>
        <p>VN Number: ${report.vnNumber}</p>
        <p>Status: ${report.status}</p>
        ${report.adminNote ? `<p>Admin Note: ${report.adminNote}</p>` : ''}
        ${report.partnerNote ? `<p>Partner Note: ${report.partnerNote}</p>` : ''}
      `,
      attachments: [{
        filename: `report_${report.reportNumber}.pdf`,
        path: report.pdfFile
      }]
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Report sent to customer successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete report
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate({
        path: 'partnerId',
        select: 'adminId'
      });

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if admin owns this report's partner
    if (report.partnerId.adminId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete PDF file if it exists
    if (report.pdfFile && fs.existsSync(report.pdfFile)) {
      fs.unlinkSync(report.pdfFile);
    }

    await Report.findByIdAndDelete(req.params.id);

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update PDF file
exports.updatePdf = async (req, res) => {
  try {
    // Handle file upload
    upload(req, res, async function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No PDF file provided' });
      }

      const report = await Report.findById(req.params.id);
      if (!report) {
        // Delete uploaded file if report not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Report not found' });
      }

      // Delete old PDF file if it exists
      if (report.pdfFile && fs.existsSync(report.pdfFile)) {
        fs.unlinkSync(report.pdfFile);
      }

      // Update report with new PDF file path
      report.pdfFile = req.file.path;
      await report.save();

      res.json({
        message: 'PDF file updated successfully',
        pdfFile: report.pdfFile
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

