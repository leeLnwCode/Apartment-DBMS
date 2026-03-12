const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");

router.get("/", roomController.getAllRooms);
router.get("/:id", roomController.getRoomById);
router.put("/:id/status", roomController.updateRoomStatus);

module.exports = router;