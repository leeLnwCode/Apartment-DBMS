const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/',                        userController.getAllUsers);
router.post('/',                       userController.createUser);
router.post('/edit/:id',                 userController.updateUser);

// Soft Delete (เดิมชื่อ delete แต่ตอนนี้เป็น deactivate)
router.delete('/:id',                  userController.deleteUser);

// NEW: Checkout ลูกบ้าน (deactivate + reset ห้องเป็น AVAILABLE)
router.post('/checkout/:accId',        userController.checkoutUser);

// NEW: ดูประวัติลูกบ้านทั้งหมดของห้อง
router.get('/history/:roomId',         userController.getRoomHistory);

module.exports = router;
