// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));



/**
 * OTP Schema and Model
 * This collection stores OTP records.
 */
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// (Optional) TTL index is removed so the OTP record is stored permanently.
 // otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 });

const OTP = mongoose.model('OTP', otpSchema);
/**
 * User Schema and Model
 */
const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  dob: { type: String },
  gender: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

/**
 * POST /send-otp
 * - Accepts a phone number, creates a user if not exists,
 *   and creates or updates an OTP record with a random 6-digit OTP.
 */
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required" });
  }

  try {
    // Create user if not exists
    let user = await User.findOne({ phone });
    if (!user) {
      user = await new User({ phone }).save();
      console.log("User created:", user);
    } else {
      console.log("User already exists:", user);
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Upsert the OTP record (update if exists, otherwise create)
    const otpRecord = await OTP.findOneAndUpdate(
      { phone },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    console.log("OTP record:", otpRecord);

    // For testing, return the OTP in the response (in production, send via SMS)
    return res.json({ success: true, message: "OTP sent successfully", otp });
  } catch (err) {
    console.error("Error in /send-otp:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /resend-otp
 * - Resends a new OTP record for the phone number.
 */
app.post('/resend-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number is required" });
  }
  try {
    // Generate a new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpRecord = await OTP.findOneAndUpdate(
      { phone },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    console.log("Resent OTP record:", otpRecord);
    return res.json({ success: true, message: "OTP resent successfully", otp });
  } catch (err) {
    console.error("Error in /resend-otp:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /verify-otp
 * - Verifies the OTP provided by the client.
 */
app.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
  }
  try {
    const record = await OTP.findOne({ phone });
    if (!record) {
      return res.status(404).json({ success: false, message: "OTP not found" });
    }
    if (record.otp === otp) {
      // Optionally, delete the OTP record after verification
      await OTP.deleteOne({ phone });
      return res.json({ success: true, message: "OTP verified successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (err) {
    console.error("Error in /verify-otp:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
/**
 * POST /save-user-details
 * Saves user details (name, dob, gender) after OTP verification.
 */
app.post('/save-user-details', async (req, res) => {
  const { phone, name, dob, gender } = req.body;

  if (!phone || !name || !dob || !gender) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  try {
    const user = await User.findOneAndUpdate(
      { phone },
      { name, dob, gender },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "User details saved successfully" });
  } catch (err) {
    console.error("Error in /save-user-details:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});