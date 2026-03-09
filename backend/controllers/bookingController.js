const db = require("../db");

// ==========================
// CREATE BOOKING (พร้อม slip)
// ==========================
exports.createBooking = async (req, res) => {
  let conn;
  try {
    const { roomId, fullName, phone, email } = req.body;
    const slipFile = req.file;

    console.log("[DEBUG] req.body:", req.body);
    console.log("[DEBUG] req.file:", req.file);

    if (!roomId || !fullName || !phone || !email || !slipFile) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลและอัปโหลดสลิป" });
    }

    const fileName = slipFile.filename || `${Date.now()}-${slipFile.originalname}`;
    console.log("[DEBUG] ชื่อไฟล์ที่ใช้บันทึก:", fileName);

    conn = await db.getConnection();

    // [ENHANCEMENT] ตรวจสอบคำขอจองซ้ำซ้อน
    const pendingCheck = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM Booking WHERE RoomID = :roomId AND BKStatus = 'WAITING_VERIFY'`,
      { ":roomId": roomId }
    );
    if (pendingCheck.rows[0].CNT > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ห้องนี้มีรายการจองที่รอการตรวจสอบอยู่แล้ว ไม่สามารถจองซ้ำได้' 
      });
    }

    // 1. สร้าง Booker
    const bookerResult = await conn.execute(
      `INSERT INTO Booker (BName, BPhone, BEmail) VALUES (:bname, :bphone, :bemail)`,
      {
        ":bname": fullName,
        ":bphone": phone,
        ":bemail": email
      }
    );
    const bookerId = bookerResult.lastID;

    // 2. สร้าง Booking
    const bookingResult = await conn.execute(
      `INSERT INTO Booking (BKStatus, BKDate, BookerID, RoomID)
       VALUES ('WAITING_VERIFY', CURRENT_TIMESTAMP, :bookerId, :roomId)`,
      {
        ":bookerId": bookerId,
        ":roomId": roomId
      }
    );
    const bookingId = bookingResult.lastID;

    // 3. สร้าง Payment
    await conn.execute(
      `INSERT INTO Payment
         (PayStatus, PayDate, PayFiles, PayAmount, BookingID, BookerID, RoomID, PayType)
       VALUES
         ('WAITING_VERIFY', CURRENT_TIMESTAMP, :payFiles, 5500, :bookingId, :bookerId, :roomId, 'DEPOSIT')`,
      {
        ":payFiles": fileName,
        ":bookingId": bookingId,
        ":bookerId": bookerId,
        ":roomId": roomId
      }
    );

    // SQLite auto-commits, but we keep the structure for compatibility
    await conn.commit();

    console.log("[SUCCESS] บันทึกการจองสำเร็จ");
    console.log(" - BookerID:", bookerId);
    console.log(" - BookingID:", bookingId);

    res.json({ success: true, bookingId, message: "จองสำเร็จ รอตรวจสอบสลิป" });

  } catch (err) {
    console.error("[ERROR] createBooking:", err);
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาดในการจอง" });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// GET ALL BOOKINGS
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
        p.PayID,
        p.PayFiles,
        bk.BName AS BNAME,
        bk.BPhone AS BPHONE,
        bk.BEmail AS BEMAIL
      FROM Booking b
      JOIN Booker bk ON b.BookerID = bk.BookerID
      LEFT JOIN Payment p ON p.BookingID = b.BookingID
      WHERE b.BKStatus IN ('WAITING_VERIFY','APPROVED')
      ORDER BY b.BookingID DESC`
    );

    res.json(result.rows);

  } catch (err) {
    console.error("Error in getAllBookings:", err);
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาดในการดึงคำจอง" });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// APPROVE BOOKING
// ==========================
exports.approveBooking = async (req, res) => {
  let conn;
  try {
    const { bookingId } = req.params;
    conn = await db.getConnection();

    const roomRes = await conn.execute(
      `SELECT b.RoomID, bk.BName, bk.BPhone, bk.BEmail 
       FROM Booking b 
       JOIN Booker bk ON b.BookerID = bk.BookerID 
       WHERE b.BookingID = :bookingId`,
      { ":bookingId": bookingId }
    );
    if (roomRes.rows.length === 0) return res.status(404).json({ success: false, message: "ไม่พบคำจอง" });

    const row = roomRes.rows[0];
    const roomId = row.RoomID;
    const bName = row.BName;
    const bPhone = row.BPhone;
    const bEmail = row.BEmail;

    // 1. Deactivate Account
    await conn.execute(`UPDATE Account SET IS_ACTIVE = 0 WHERE RoomID = :roomId AND IS_ACTIVE = 1`, { ":roomId": roomId });

    // 2. สร้าง Account
    const accUser = `room${roomId}`;
    const accPass = bPhone || '123456';

    const accResult = await conn.execute(
      `INSERT INTO Account (AccUser, AccPass, RoomID, IS_ACTIVE) VALUES (:accUser, :accPass, :roomId, 1)`,
      { ":accUser": accUser, ":accPass": accPass, ":roomId": roomId }
    );
    const accId = accResult.lastID;

    // 3. สร้าง Member
    await conn.execute(
      `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
       VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
      { ":memName": bName, ":memPhone": bPhone, ":memEmail": bEmail || null, ":accId": accId, ":roomId": roomId }
    );

    // 4. Update Statuses
    await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :bookingId`, { ":bookingId": bookingId });
    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE RoomID = :roomId`, { ":roomId": roomId });
    await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :bookingId`, { ":bookingId": bookingId });

    await conn.commit();
    res.json({ success: true, message: "อนุมัติและสร้างบัญชีผู้ใช้สำเร็จ!" });
  } catch (err) {
    console.error('[approveBooking] ERROR:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// ==========================
// Check Pending
// ==========================
exports.checkPendingForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await db.getConnection();
    const result = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM Booking WHERE ROOMID = :roomId AND BKSTATUS = 'WAITING_VERIFY'`,
      { ":roomId": roomId }
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
// Auto Approve
// ==========================
exports.autoApproveForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await db.getConnection();

    const bookings = await conn.execute(
      `SELECT b.BookingID, bk.BName, bk.BPhone, bk.BEmail 
       FROM Booking b 
       JOIN Booker bk ON b.BookerID = bk.BookerID 
       WHERE b.ROOMID = :roomId AND b.BKSTATUS = 'WAITING_VERIFY' 
       ORDER BY b.BKDATE ASC`,
      { ":roomId": roomId }
    );

    if (bookings.rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่มีคำขอรอตรวจสอบ" });
    }

    for (let i = 0; i < bookings.rows.length; i++) {
      const row = bookings.rows[i];
      const bookingId = row.BookingID;

      if (i === 0) {
        const bName = row.BName;
        const bPhone = row.BPhone;
        const bEmail = row.BEmail;

        await conn.execute(`UPDATE Account SET IS_ACTIVE = 0 WHERE RoomID = :roomId AND IS_ACTIVE = 1`, { ":roomId": roomId });
        const accUser = `room${roomId}`;
        const accPass = bPhone || '123456';

        const accResult = await conn.execute(
          `INSERT INTO Account (AccUser, AccPass, RoomID, IS_ACTIVE) VALUES (:accUser, :accPass, :roomId, 1)`,
          { ":accUser": accUser, ":accPass": accPass, ":roomId": roomId }
        );
        const accId = accResult.lastID;

        await conn.execute(
          `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
           VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
          { ":memName": bName, ":memPhone": bPhone, ":memEmail": bEmail || null, ":accId": accId, ":roomId": roomId }
        );
      }

      await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :id`, { ":id": bookingId });
      await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :id`, { ":id": bookingId });
    }

    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE ROOMID = :roomId`, { ":roomId": roomId });
    await conn.commit();
    res.json({ success: true, approvedCount: bookings.rows.length, message: "อนุมัติอัตโนมัติและสร้างบัญชีสำเร็จ!" });
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
    const result = await conn.execute(`SELECT PayFiles FROM Payment WHERE BookingID = :bookingId`, { ":bookingId": bookingId });
    if (result.rows.length === 0) return res.status(404).send("ไม่พบสลิป");
    res.setHeader("Content-Type", "image/jpeg");
    res.send(result.rows[0].PAYFILES);
  } catch (err) {
    res.status(500).send(err.message);
  } finally {
    if (conn) await conn.close();
  }
};
