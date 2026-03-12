const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/slips/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('payFile'), paymentController.createPayment);
router.get('/', paymentController.getAllPayments);
router.get('/slip/:payId', paymentController.getSlip);
router.get('/room/:roomId', paymentController.getPaymentsByRoom);
router.get('/member/:accId', paymentController.getPaymentsByAccId);

module.exports = router;