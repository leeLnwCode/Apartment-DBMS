const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// จอง + อัปโหลดสลิป
router.post("/create", upload.single("slip"), bookingController.createBooking);

// แอดมินเห็นเฉพาะคำจองที่รอตรวจ
router.get("/", bookingController.getAllBookings);

// อนุมัติคำจอง (ปุ่มปกติ)
router.put("/approve/:bookingId", bookingController.approveBooking);

// เช็คคำขอรอตรวจ (สำหรับ toggle)
router.get("/pending/:roomId", bookingController.checkPendingForRoom);

// อนุมัติอัตโนมัติเมื่อปิดห้อง
router.post("/auto-approve/:roomId", bookingController.autoApproveForRoom);

// ดูสลิป
router.get("/payments/slip/:bookingId", bookingController.getSlipByBookingId);

module.exports = router;