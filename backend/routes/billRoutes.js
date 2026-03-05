// routes/billRoutes.js
const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');

router.post('/', billController.createBill);
router.get('/', billController.getAllBills);
router.get('/room/:roomId', billController.getBillsByRoom);
router.get('/member/:accId', billController.getBillsByAccId);
router.post('/pay', billController.payBill);
router.delete('/:billId', billController.deleteBill);

router.get("/last/:roomId", billController.getLastBillByRoom);

module.exports = router;