const db = require("../db");

// ==========================
// GET ALL ROOMS
// ==========================
async function getAllRooms(req, res) {
  let conn;
  try {
    conn = await db.getConnection();
    const result = await conn.execute(`SELECT * FROM Room ORDER BY RoomID`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error in getAllRooms:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูลห้องพัก" });
  } finally {
    if (conn) await conn.close();
  }
}

// ==========================
// GET ROOM BY ID
// ==========================
async function getRoomById(req, res) {
  let conn;
  try {
    const roomId = req.params.id;
    conn = await db.getConnection();
    const result = await conn.execute(`SELECT * FROM Room WHERE RoomID = :id`, { ":id": roomId });
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: `ไม่พบห้อง ${roomId}` });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error in getRoomById:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง" });
  } finally {
    if (conn) await conn.close();
  }
}

// ==========================
// UPDATE ROOM STATUS
// ==========================
async function updateRoomStatus(req, res) {
  let conn;
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['AVAILABLE', 'OCCUPIED'].includes(status)) {
      return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
    }

    conn = await db.getConnection();
    const result = await conn.execute(`UPDATE Room SET RSTATUS = :status WHERE ROOMID = :id`, { ":status": status, ":id": id });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: `ไม่พบห้อง ${id}` });
    await conn.commit();
    res.json({ success: true, message: `อัปเดตสถานะห้อง ${id} เป็น ${status} เรียบร้อย` });
  } catch (err) {
    console.error("Error in updateRoomStatus:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = {
  getAllRooms,
  getRoomById,
  updateRoomStatus
};