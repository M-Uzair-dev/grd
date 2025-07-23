const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Handle preflight OPTIONS requests for all routes
app.options("*", cors());

// Serve static files from uploads directory (no caching)
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  etag: false,
  maxAge: 0,
  cacheControl: false
}));

// Routes
const authRoutes = require("./routes/auth.routes");
const partnerRoutes = require("./routes/partner.routes");
const customerRoutes = require("./routes/customer.routes");
const unitRoutes = require("./routes/unit.routes");
const reportRoutes = require("./routes/report.routes");

app.use("/api/auth", authRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/reports", reportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
