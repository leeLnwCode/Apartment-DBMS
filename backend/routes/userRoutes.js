const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.post('/edit/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/checkout/:accId', userController.checkoutUser);
router.get('/history/:roomId', userController.getRoomHistory);

module.exports = router;
