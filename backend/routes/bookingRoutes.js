const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, "../uploads/slips");
    require("fs").mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post("/create", upload.single("payFile"), bookingController.createBooking);
router.get("/", bookingController.getAllBookings);
router.put("/approve/:bookingId", bookingController.approveBooking);
router.get("/pending/:roomId", bookingController.checkPendingForRoom);
router.post("/auto-approve/:roomId", bookingController.autoApproveForRoom);
router.get("/payments/slip/:bookingId", bookingController.getSlipByBookingId);

module.exports = router;