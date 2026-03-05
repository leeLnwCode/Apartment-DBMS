const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/', paymentController.getAllPayments);

router.post(
  '/',
  paymentController.upload.single('payFile'),
  paymentController.createPayment
);

router.get('/slip/:payId', paymentController.getSlip);

// สำหรับดู payment ของห้อง
router.get('/room/:roomId', paymentController.getPaymentsByRoom);
router.get("/payments", paymentController.getAllPayments);

// สำหรับลูกบ้าน
router.get('/member/:accId', paymentController.getPaymentsByAccId);

module.exports = router;