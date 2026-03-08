const db = require("../db");
const oracledb = require("oracledb");

// ==========================
// GET ALL ROOMS
// ==========================
async function getAllRooms(req, res) {
  let conn;
  try {
    conn = await db.getConnection();
    const result = await conn.execute(
      `SELECT * FROM Room ORDER BY RoomID`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error in getAllRooms:", err);
    res.status(500).json({
      success: false,
      message: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลห้องพัก"
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (closeErr) { console.error("Close connection error:", closeErr); }
    }
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

    const result = await conn.execute(
      `SELECT * FROM Room WHERE RoomID = :id`,
      { id: roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบห้อง ${roomId}`
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error in getRoomById:", err);
    res.status(500).json({
      success: false,
      message: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลห้อง"
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (closeErr) { console.error("Close connection error:", closeErr); }
    }
  }
}

// ==========================
// UPDATE ROOM STATUS (AVAILABLE / OCCUPIED)
// ==========================
async function updateRoomStatus(req, res) {
  let conn;
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['AVAILABLE', 'OCCUPIED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "สถานะต้องเป็น 'AVAILABLE' หรือ 'OCCUPIED'"
      });
    }

    conn = await db.getConnection();

    const result = await conn.execute(
      `UPDATE Room 
       SET RSTATUS = :status 
       WHERE ROOMID = :id`,
      { status, id }
    );

    await conn.commit();

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: `ไม่พบห้อง ${id} เพื่ออัปเดตสถานะ`
      });
    }

    res.json({
      success: true,
      message: `อัปเดตสถานะห้อง ${id} เป็น ${status} เรียบร้อย`
    });
  } catch (err) {
    console.error("Error in updateRoomStatus:", err);
    if (conn) await conn.rollback(); // ยกเลิก transaction ถ้าผิดพลาด
    res.status(500).json({
      success: false,
      message: err.message || "เกิดข้อผิดพลาดในการอัปเดตสถานะห้อง"
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (closeErr) { console.error("Close connection error:", closeErr); }
    }
  }
}

// Export ทั้งหมดให้ถูกต้อง (แบบเดียวกัน)
module.exports = {
  getAllRooms,
  getRoomById,
  updateRoomStatus
};