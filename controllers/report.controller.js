'use client';

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

// Configure multer for disk storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/reports';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and original extension
    const timestamp = Date.now();
    const reportNumber = req.body.reportNumber || 'WO';
    const extension = path.extname(file.originalname) || '.pdf';
    cb(null, `${reportNumber}_${timestamp}${extension}`);
  }
});

// Configure multer upload
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

      try {
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
          return res.status(400).json({ message: 'Missing required fields (Report Number, VN Number, Partner, Customer, and PDF File are required)' });
        }

      // Ensure report number has WO prefix
      const formattedReportNumber = reportNumber.startsWith('WO') ? reportNumber : `WO${reportNumber}`;

        // Create the report with the file path
      const report = await Report.create({
        reportNumber: formattedReportNumber,
        vnNumber,
        pdfFile: `/uploads/reports/${req.file.filename}`, // Store the relative path
        adminNote,
        partnerId,
        customerId,
        unitId,
        status,
        isNew: true
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
      } catch (error) {
        // If there's an error and a file was uploaded, delete it
        if (req.file) {
          const filePath = path.join('./uploads/reports', req.file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        console.error('Report creation error:', error);
        res.status(500).json({ message: error.message });
      }
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
      adminNote,
      partnerNote,
      status,
      partnerId,
      customerId,
      unitId
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

    // If changing partner, verify the new partner belongs to the admin
    if (partnerId && partnerId !== report.partnerId._id.toString()) {
      const newPartner = await Partner.findById(partnerId);
      if (!newPartner || newPartner.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign report to this partner' });
      }
    }

    // If changing customer, verify it belongs to the partner
    if (customerId) {
      const customer = await Customer.findById(customerId).populate('partnerId');
      if (!customer || customer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign report to this customer' });
      }
    }

    // If changing unit, verify it belongs to the customer
    if (unitId) {
      const unit = await Unit.findById(unitId).populate({
        path: 'customerId',
        populate: {
          path: 'partnerId'
        }
      });
      if (!unit || unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign report to this unit' });
      }
    }

    // Update all fields
    report.reportNumber = reportNumber || report.reportNumber;
    report.vnNumber = vnNumber || report.vnNumber;
    report.adminNote = adminNote !== undefined ? adminNote : report.adminNote;
    report.partnerNote = partnerNote !== undefined ? partnerNote : report.partnerNote;
    report.status = status || report.status;
    report.partnerId = partnerId || report.partnerId;
    report.customerId = customerId || report.customerId;
    report.unitId = unitId === '' ? null : (unitId || report.unitId); // Allow removing unit by setting to empty string

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
    console.error('Error updating report:', error);
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

// Mark report as read
exports.markAsRead = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if partner owns this report
    if (report.partnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    report.isNew = false;
    await report.save();

    res.json({
      message: 'Report marked as read',
      report: await report.populate([
        { path: 'partnerId', select: 'name email' },
        { path: 'customerId', select: 'name email' },
        { path: 'unitId', select: 'unitName' }
      ])
    });
  } catch (error) {
    console.error('Error marking report as read:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send report to customer
exports.sendReportToCustomer = async (req, res) => {
  try {
    console.log('Starting sendReportToCustomer process:', {
      reportId: req.params.id
    });

    const report = await Report.findById(req.params.id)
      .populate([
        { path: 'partnerId', select: 'name email _id' },
        { path: 'customerId', select: 'name email' },
        { 
          path: 'unitId',
          populate: {
            path: 'customerId',
            select: 'name email'
          }
        }
      ]);

    if (!report) {
      console.error('Report not found:', req.params.id);
      return res.status(404).json({ message: 'Report not found' });
    }

    // Determine which customer email to use
    let customerEmail;
    let customerName;

    if (report.unitId && report.unitId.customerId) {
      // If report is in a unit, use the unit's customer details
      customerEmail = report.unitId.customerId.email;
      customerName = report.unitId.customerId.name;
      console.log('Using unit customer information:', {
        customerEmail,
        customerName,
        unitName: report.unitId.unitName
      });
    } else if (report.customerId) {
      // If report is directly in customer, use customer details
      customerEmail = report.customerId.email;
      customerName = report.customerId.name;
      console.log('Using direct customer information:', {
        customerEmail,
        customerName
      });
    }

    if (!customerEmail) {
      console.error('No customer email found:', {
        hasUnit: !!report.unitId,
        hasCustomer: !!report.customerId,
        reportId: report._id
      });
      throw new Error('Customer email not found for this report');
    }

    const pdfPath = path.join(__dirname, '..', report.pdfFile);
    if (!fs.existsSync(pdfPath)) {
      throw new Error('Report PDF file not found');
    }

    // Send email to customer
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: customerEmail,
      subject: `Report ${report.reportNumber} Available`,
      html: `
        <h1>Report Details</h1>
        <p>Dear ${customerName},</p>
        <p>A new report is available for your review:</p>
        <p>Report Number: ${report.reportNumber}</p>
        <p>VN Number: ${report.vnNumber}</p>
        <p>Status: ${report.status}</p>
        <p>Partner: ${report.partnerId.name}</p>
        <p>Partner Email: ${report.partnerId.email}</p>
        ${report.unitId ? `<p>Unit: ${report.unitId.unitName}</p>` : ''}
        ${report.adminNote ? `<p>Admin Note: ${report.adminNote}</p>` : ''}
        ${report.partnerNote ? `<p>Partner Note: ${report.partnerNote}</p>` : ''}
        <br>
        <p>The report is attached to this email.</p>
      `,
      attachments: [{
        filename: `report_${report.reportNumber}.pdf`,
        path: pdfPath
      }]
    };

    console.log('Sending email to customer:', {
      to: customerEmail,
      subject: mailOptions.subject,
      reportNumber: report.reportNumber
    });

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully to customer:', customerEmail);

    // Mark report as read when sent
    report.isNew = false;
    await report.save();
    console.log('Report marked as read:', report._id);

    res.json({ message: 'Report sent to customer successfully' });
  } catch (error) {
    console.error('Error in sendReportToCustomer:', {
      error: error.message,
      stack: error.stack,
      reportId: req.params.id
    });
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

    // Delete the PDF file if it exists
    if (report.pdfFile) {
      const filePath = path.join('.', report.pdfFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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

      try {
      const report = await Report.findById(req.params.id);
      if (!report) {
          // Delete the newly uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        return res.status(404).json({ message: 'Report not found' });
      }

        // Delete old PDF file if it exists
        if (report.pdfFile) {
          const oldFilePath = path.join('.', report.pdfFile);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }

        // Update report with new PDF file path
        report.pdfFile = `/uploads/reports/${req.file.filename}`;
      await report.save();

      res.json({
        message: 'PDF file updated successfully',
        pdfFile: report.pdfFile
      });
      } catch (error) {
        // Clean up the new file if there was an error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        console.error('Error updating PDF:', error);
        res.status(500).json({ message: error.message });
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download report
exports.downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user has access to this report
    if (req.user.role === 'partner' && report.partnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this report' });
    }

    if (!report.pdfFile) {
      return res.status(404).json({ message: 'No PDF file found for this report' });
    }

    const filePath = path.join('.', report.pdfFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file not found on server' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${path.basename(report.pdfFile)}`);

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Failed to download report' });
  }
};

