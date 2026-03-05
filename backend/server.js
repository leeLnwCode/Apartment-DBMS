const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const roomRoutes = require("./routes/roomRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const userRoutes = require('./routes/userRoutes');
const billRoutes = require('./routes/billRoutes');
const contractRoutes = require("./routes/contractRoutes");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bills', billRoutes);
app.use("/api/contracts", contractRoutes);

const PORT = process.env.PORT || 3000;

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'ไม่พบเส้นทางที่ร้องขอ'
  });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});