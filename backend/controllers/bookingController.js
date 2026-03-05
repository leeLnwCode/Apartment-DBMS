const db = require("../db");
const oracledb = require("oracledb");

// ==========================
// CREATE BOOKING (พร้อม slip)
// ==========================
exports.createBooking = async (req, res) => {
  let conn;
  try {
    const { roomId, fullName, phone, email } = req.body;
    const slipFile = req.file;

    if (!roomId || !fullName || !phone || !email || !slipFile) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลและอัปโหลดสลิป" });
    }

    conn = await db.getConnection();
    const slipName = slipFile.filename;

    // 1. Create Booker
    const bookerResult = await conn.execute(
      `INSERT INTO Booker (BookerID, BName, BPhone, BEmail)
       VALUES (Booker_SEQ.NEXTVAL, :bname, :bphone, :bemail)
       RETURNING BookerID INTO :outBookerId`,
      { bname: fullName, bphone: phone, bemail: email, outBookerId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    const bookerId = bookerResult.outBinds.outBookerId[0];

    // 2. Create Booking
    const bookingResult = await conn.execute(
      `INSERT INTO Booking (BookingID, BKStatus, BKDate, BookerID, RoomID)
       VALUES (Booking_SEQ.NEXTVAL, 'WAITING_VERIFY', SYSDATE, :bookerId, :roomId)
       RETURNING BookingID INTO :outBookingId`,
      { bookerId, roomId, outBookingId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    const bookingId = bookingResult.outBinds.outBookingId[0];

    // 3. Create Payment
    await conn.execute(
      `INSERT INTO Payment (PayID, BILLID, PayStatus, PayDate, PayFiles, PayAmount, BookingID, BookerID, RoomID)
       VALUES (Payment_SEQ.NEXTVAL, Bill_SEQ.NEXTVAL, 'WAITING_VERIFY', SYSDATE, :slip, 5500, :bookingId, :bookerId, :roomId)`,
      { slip: slipFile.filename, bookingId, bookerId, roomId }
    );

    await conn.commit();
    res.json({ success: true, bookingId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// GET ALL BOOKINGS (เฉพาะ WAITING_VERIFY) ← แก้ตรงนี้
// ==========================
exports.getAllBookings = async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT 
         b.BookingID, 
         b.BKStatus, 
         b.BKDate, 
         b.RoomID, 
         bk.BName AS BNAME, 
         bk.BPhone AS BPHONE, 
         bk.BEmail AS BEMAIL
       FROM Booking b
       JOIN Booker bk ON b.BookerID = bk.BookerID
       WHERE b.BKStatus = 'WAITING_VERIFY'
       ORDER BY b.BookingID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // ส่งข้อมูลที่ clean แล้ว (ไม่มี BLOB/PayFiles)
    res.json(result.rows);

  } catch (err) {
    console.error("Error in getAllBookings:", err);
    res.status(500).json({
      success: false,
      message: err.message || "เกิดข้อผิดพลาดในการดึงคำจอง"
    });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// APPROVE BOOKING (ปุ่มอนุมัติปกติ)
// ==========================
exports.approveBooking = async (req, res) => {
  let conn;
  try {
    const { bookingId } = req.params;
    conn = await db.getConnection();

    const roomRes = await conn.execute(`SELECT RoomID FROM Booking WHERE BookingID = :bookingId`, { bookingId });
    if (roomRes.rows.length === 0) return res.status(404).json({ success: false, message: "ไม่พบคำจอง" });

    const roomId = roomRes.rows[0].ROOMID;

    await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :bookingId`, { bookingId });
    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE RoomID = :roomId`, { roomId });
    await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :bookingId`, { bookingId });

    await conn.commit();
    res.json({ success: true, message: "อนุมัติสำเร็จ! ห้องถูกจองแล้ว" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// NEW: เช็คว่ามีคำขอรอตรวจสอบหรือไม่ (สำหรับ toggle)
// ==========================
exports.checkPendingForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM Booking WHERE ROOMID = :roomId AND BKSTATUS = 'WAITING_VERIFY'`,
      { roomId }
    );

    const hasPending = result.rows[0].CNT > 0;
    res.json({ hasPending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// NEW: อนุมัติอัตโนมัติเมื่อปิดห้อง (toggle)
// ==========================
exports.autoApproveForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await db.getConnection();

    const bookings = await conn.execute(
      `SELECT BookingID FROM Booking WHERE ROOMID = :roomId AND BKSTATUS = 'WAITING_VERIFY' ORDER BY BKDATE ASC`,
      { roomId }
    );

    if (bookings.rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่มีคำขอรอตรวจสอบ" });
    } 

    for (const row of bookings.rows) {
      const bookingId = row.BOOKINGID;
      await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :id`, { id: bookingId });
      await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :id`, { id: bookingId });
    }

    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE ROOMID = :roomId`, { roomId });
    await conn.commit();

    res.json({ success: true, approvedCount: bookings.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// GET SLIP
// ==========================
exports.getSlipByBookingId = async (req, res) => {
  let conn;
  try {
    const bookingId = req.params.bookingId;
    conn = await db.getConnection();

    const result = await conn.execute(`SELECT PayFiles FROM Payment WHERE BookingID = :bookingId`, { bookingId });
    if (result.rows.length === 0) return res.status(404).send("ไม่พบสลิป");

    res.setHeader("Content-Type", "image/jpeg");
    res.send(result.rows[0].PAYFILES);
  } catch (err) {
    res.status(500).send(err.message);
  } finally {
    if (conn) await conn.close();
  }
};