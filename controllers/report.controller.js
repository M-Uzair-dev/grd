'use client';

const Report = require('../models/report.model');
const Unit = require('../models/unit.model');
const Customer = require('../models/customer.model');
const Partner = require('../models/partner.model');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // true for 465 (SSL)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: true
  }
});

// Verify email configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Get all reports
const getAllReports = async (req, res) => {
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
const getPartnerReports = async (req, res) => {
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
const getReportById = async (req, res) => {
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
const createReport = async (req, res) => {
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files were uploaded. Please select at least one file.' });
    }

    const { 
      reportNumber, 
      vnNumber, 
      adminNote, 
      partnerId, 
      customerId, 
      unitId,
      status,
      sendEmail
    } = req.body;

    // Basic validation
    if (!reportNumber || !vnNumber || !partnerId) {
      return res.status(400).json({ message: 'Missing required fields (Report Number, VN Number, and Partner are required)' });
    }

    // Ensure report number has WO prefix
    const formattedReportNumber = reportNumber.startsWith('WO') ? reportNumber : `WO${reportNumber}`;

    // Process uploaded files
    const files = req.files.map(file => ({
      originalName: file.originalname,
      path: `/uploads/reports/${file.filename}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date()
    }));

    // Create the report with the files
    const report = await Report.create({
      reportNumber: formattedReportNumber,
      vnNumber,
      files,
      adminNote,
      partnerId,
      customerId: customerId || undefined,
      unitId: unitId || undefined,
      status,
      isNew: true
    });

    // Only send email if sendEmail is true
    if (sendEmail === 'true') {
      // Get partner email for notification
      const partner = await Partner.findById(partnerId);
      if (partner && partner.email) {
        // Prepare file attachments
        const attachments = files.map(file => ({
          filename: file.originalName,
          path: path.join('.', file.path)
        }));

        // Compose customer/unit info for email
        let customerName = '';
        let unitName = '';
        if (customerId) {
          const customer = await Customer.findById(customerId);
          customerName = customer ? customer.name : '';
        }
        if (unitId) {
          const unit = await Unit.findById(unitId);
          unitName = unit ? unit.unitName : '';
        }

        // Send email to partner
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: partner.email,
          subject: `New Report Available - ${formattedReportNumber}`,
          html: `
            <h2>New Report Available</h2>
            <p>Hello ${partner.name},</p>
            <p>A new report has been generated with the following details:</p>
            <ul>
              <li>Report Number: ${formattedReportNumber}</li>
              <li>VN Number: ${vnNumber}</li>
              <li>Status: ${status}</li>
              ${customerName ? `<li>Customer: ${customerName}</li>` : ''}
              ${unitName ? `<li>Unit: ${unitName}</li>` : ''}
              ${adminNote ? `<li>Admin Note: ${adminNote}</li>` : ''}
            </ul>
            <p>The report files are attached to this email for your reference.</p>
            <p>You can also log in to your dashboard to view the full report.</p>
          `,
          attachments
        };

        await transporter.sendMail(mailOptions);
      }
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
    // If there's an error and files were uploaded, delete them
    if (req.files) {
      req.files.forEach(file => {
        const filePath = path.join('./uploads/reports', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
    console.error('Report creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update report
const updateReport = async (req, res) => {
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
        return res.status(403).json({ message: 'Not authorized to assign reports to this partner' });
      }
    }

    // If changing customer, verify it belongs to the partner
    if (customerId) {
      const customer = await Customer.findById(customerId).populate('partnerId');
      if (!customer || customer.partnerId.adminId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to assign reports to this customer' });
      }
    }

    // If changing unit, verify it belongs to either the customer or partner
    if (unitId) {
      const unit = await Unit.findById(unitId)
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
        // Unit belongs to a customer
        if (unit.customerId.partnerId.adminId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to assign reports to this unit' });
        }
      } else if (unit.partnerId) {
        // Unit belongs to a partner
        if (unit.partnerId.adminId.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized to assign reports to this unit' });
        }
      } else {
        return res.status(400).json({ message: 'Invalid unit: must be associated with either customer or partner' });
      }
    }

    // Update all fields
    report.reportNumber = reportNumber || report.reportNumber;
    report.vnNumber = vnNumber || report.vnNumber;
    report.adminNote = adminNote !== undefined ? adminNote : report.adminNote;
    report.partnerNote = partnerNote !== undefined ? partnerNote : report.partnerNote;
    report.status = status || report.status;
    report.partnerId = partnerId || report.partnerId;
    report.customerId = customerId === '' ? null : (customerId || report.customerId); // Allow removing customer by setting to empty string
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
const updatePartnerNote = async (req, res) => {
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
const markAsRead = async (req, res) => {
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
      message: 'Reports marked as read',
      reports: await report.populate([
        { path: 'partnerId', select: 'name email' },
        { path: 'customerId', select: 'name email' },
        { path: 'unitId', select: 'unitName' }
      ])
    });
  } catch (error) {
    console.error('Error marking reports as read:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send report to customer
const sendReportToCustomer = async (req, res) => {
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
          populate: [
            { path: 'customerId', select: 'name email' },
            { path: 'partnerId', select: 'name email' }
          ]
        }
      ]);

    if (!report) {
      console.error('Report not found:', req.params.id);
      return res.status(404).json({ message: 'Report not found' });
    }

    // Determine which customer email to use
    let customerEmail;
    let customerName;

    if (report.unitId) {
      // Unit is associated with either a customer or partner
      if (report.unitId.customerId) {
        // Unit belongs to a customer
        customerEmail = report.unitId.customerId.email;
        customerName = report.unitId.customerId.name;
        console.log('Using unit customer information:', {
          customerEmail,
          customerName,
          unitName: report.unitId.unitName
        });
      } else if (report.unitId.partnerId) {
        // Unit belongs to a partner - we can't send to partner directly
        // This should not happen in normal flow, but handle gracefully
        console.log('Unit belongs to partner, cannot send to customer:', {
          unitName: report.unitId.unitName,
          partnerName: report.unitId.partnerId.name
        });
        return res.status(400).json({ 
          message: 'Cannot send report to customer: Unit is associated with partner, not customer.' 
        });
      }
    } else if (report.customerId) {
      customerEmail = report.customerId.email;
      customerName = report.customerId.name;
      console.log('Using direct customer information:', {
        customerEmail,
        customerName
      });
    } else {
      // No customer or unit present
      return res.status(400).json({ message: 'No customer or unit associated with this report to send to.' });
    }

    if (!customerEmail) {
      console.error('No customer email found:', {
        hasUnit: !!report.unitId,
        hasCustomer: !!report.customerId,
        reportId: report._id
      });
      throw new Error('Customer email not found for this report');
    }

    // Prepare file attachments
    const attachments = await Promise.all(report.files.map(async file => {
      const filePath = path.join(__dirname, '..', file.path);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return null;
      }
      return {
        filename: file.originalName,
        path: filePath
      };
    }));

    // Filter out any null attachments (files that weren't found)
    const validAttachments = attachments.filter(att => att !== null);

    if (validAttachments.length === 0) {
      throw new Error('No valid files found to attach');
    }

    // Send email to customer
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: customerEmail,
      subject: `Report ${report.reportNumber} from ${report.partnerId.name}`,
      html: `
        <h2>Report Details</h2>
        <p>Dear ${customerName},</p>
        <p>I hope this email finds you well, your report is ready to be reviewed.</p>
        <ul>
          <li>Report Number: ${report.reportNumber}</li>
          <li>VN Number: ${report.vnNumber}</li>
          <li>Status: ${report.status}</li>
          ${report.unitId ? `<li>Unit: ${report.unitId.unitName}</li>` : ''}
          ${report.partnerNote ? `<li>Note: ${report.partnerNote}</li>` : ''}
        </ul>
        <p>I have attached the report files for your reference. Please review them at your convenience.</p>
        <br/>
        <p>Best regards,</p>
        <p>${report.partnerId.name}</p>
      `,
      attachments: validAttachments
    };

    console.log('Sending email to customer:', {
      to: customerEmail,
      subject: mailOptions.subject,
      reportNumber: report.reportNumber,
      attachmentCount: validAttachments.length
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
const deleteReport = async (req, res) => {
  try {
    // Handle both single and bulk deletion
    const reportIds = req.params.ids ? req.params.ids.split(',') : [req.params.id];
    
    const reports = await Report.find({ _id: { $in: reportIds } })
      .populate({
        path: 'partnerId',
        select: 'adminId'
      })
      .populate({
        path: 'customerId',
        populate: { path: 'partnerId', select: 'adminId' }
      })
      .populate({
        path: 'unitId',
        populate: { path: 'partnerId', select: 'adminId' }
      });

    if (reports.length === 0) {
      return res.status(404).json({ message: 'Reports not found' });
    }

    // Check if admin owns these reports' partners
    const unauthorizedReports = reports.filter(report => {
      // Try to get adminId from partnerId, or from customer/unit's partnerId
      let adminId = null;
      if (report.partnerId && report.partnerId.adminId) {
        adminId = report.partnerId.adminId;
      } else if (report.customerId && report.customerId.partnerId && report.customerId.partnerId.adminId) {
        adminId = report.customerId.partnerId.adminId;
      } else if (report.unitId && report.unitId.partnerId && report.unitId.partnerId.adminId) {
        adminId = report.unitId.partnerId.adminId;
      }
      if (!adminId) {
        console.error('Report missing partner or admin data:', report._id);
        return true; // Mark as unauthorized if data is missing
      }
      return adminId.toString() !== req.user._id.toString();
    });
    
    if (unauthorizedReports.length > 0) {
      return res.status(403).json({ message: 'Not authorized to delete these reports' });
    }

    // Delete the files if they exist
    reports.forEach(report => {
      if (report.files && report.files.length > 0) {
        report.files.forEach(file => {
          const filePath = path.join('.', file.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
    });

    await Report.deleteMany({ _id: { $in: reportIds } });

    res.json({ message: 'Reports deleted successfully' });
  } catch (error) {
    console.error('Error deleting reports:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update PDF file
const updatePdf = async (req, res) => {
  try {
    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No PDF files provided' });
    }

    try {
      const reports = await Report.find({ _id: { $in: req.params.ids } });
      if (reports.length === 0) {
        // Delete the newly uploaded files
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        return res.status(404).json({ message: 'Reports not found' });
      }

      // Delete old PDF files if they exist
      reports.forEach(report => {
        if (report.pdfFiles) {
          report.pdfFiles.forEach(pdfFile => {
            const oldFilePath = path.join('.', pdfFile);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
          });
        }
      });

      // Update reports with new PDF file paths
      const updatedReports = await Report.updateMany(
        { _id: { $in: req.params.ids } },
        { $set: { pdfFiles: req.files.map(file => `/uploads/reports/${file.originalname}`) } }
      );

      res.json({
        message: 'PDF files updated successfully',
        reports: await Report.find({ _id: { $in: req.params.ids } })
          .populate([
            { path: 'partnerId', select: 'name email' },
            { path: 'customerId', select: 'name email' },
            { path: 'unitId', select: 'unitName' }
          ])
      });
    } catch (error) {
      // Clean up the new files if there was an error
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      console.error('Error updating PDF files:', error);
      res.status(500).json({ message: error.message });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download report file
const downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if user has access to this report
    if (req.user.role === 'partner' && report.partnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this report' });
    }

    // Find the specific file
    const file = report.files.id(req.params.fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    const filePath = path.join('.', file.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=${file.originalName}`);

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Failed to download file' });
  }
};

// Send report to partner
const sendToPartner = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('partnerId')
      .populate('customerId')
      .populate('unitId');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (!report.partnerId) {
      return res.status(400).json({ message: 'Report has no associated partner' });
    }

    if (!report.files || report.files.length === 0) {
      return res.status(400).json({ message: 'Report has no files attached' });
    }

    // Prepare file attachments
    const attachments = await Promise.all(report.files.map(async file => {
      const filePath = path.join(__dirname, '..', file.path);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return null;
      }
      return {
        filename: file.originalName,
        path: filePath
      };
    }));

    // Filter out any null attachments (files that weren't found)
    const validAttachments = attachments.filter(att => att !== null);

    if (validAttachments.length === 0) {
      throw new Error('No valid files found to attach');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: report.partnerId.email,
      subject: `New Report Available - ${report.reportNumber}`,
      html: `
        <h2>New Report Available</h2>
        <p>Hello ${report.partnerId.name},</p>
        <p>A new report has been generated with the following details:</p>
        <ul>
          <li>Report Number: ${report.reportNumber}</li>
          <li>VN Number: ${report.vnNumber}</li>
          <li>Status: ${report.status}</li>
          <li>Customer: ${report.customerId ? report.customerId.name : 'N/A'}</li>
          ${report.unitId ? `<li>Unit: ${report.unitId.unitName}</li>` : ''}
          ${report.adminNote ? `<li>Admin Note: ${report.adminNote}</li>` : ''}
        </ul>
        <p>The report files are attached to this email for your reference.</p>
        <p>You can also view this report and manage your reports by logging into your dashboard.</p>
      `,
      attachments: validAttachments
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Email sent successfully to partner' });
  } catch (error) {
    console.error('Error in sendToPartner:', error);
    res.status(500).json({ message: 'Failed to send email to partner' });
  }
};

// Delete a specific file from a report
const deleteReportFile = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Find the file in the report
    const file = report.files.id(req.params.fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete the physical file
    const filePath = path.join('.', file.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove the file from the report's files array
    report.files.pull(req.params.fileId);
    await report.save();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add new files to an existing report
const addReportFiles = async (req, res) => {
  try {
    if (req.files.length === 0) {
      return res.status(400).json({ message: 'No files provided' });
    }

    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        // Delete uploaded files if report not found
        if (req.files) {
          req.files.forEach(file => {
            const filePath = path.join('./uploads/reports', file.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          });
        }
        return res.status(404).json({ message: 'Report not found' });
      }

      // Process uploaded files
      const newFiles = req.files.map(file => ({
        originalName: file.originalname,
        path: `/uploads/reports/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date()
      }));

      // Add new files to the report
      report.files.push(...newFiles);
      await report.save();

      res.json({
        message: 'Files added successfully',
        files: newFiles
      });
    } catch (error) {
      // Clean up uploaded files if there's an error
      if (req.files) {
        req.files.forEach(file => {
          const filePath = path.join('./uploads/reports', file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error adding files:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllReports,
  getPartnerReports,
  getReportById,
  createReport,
  updateReport,
  updatePartnerNote,
  markAsRead,
  sendReportToCustomer,
  deleteReport,
  updatePdf,
  downloadReport,
  sendToPartner,
  deleteReportFile,
  addReportFiles
};

