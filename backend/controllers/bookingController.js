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


    console.log("[DEBUG] req.body:", req.body);
    console.log("[DEBUG] req.file:", req.file);

    if (!roomId || !fullName || !phone || !email || !slipFile) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลและอัปโหลดสลิป" });
    }

    // แก้จุดนี้: ใช้ filename ถ้ามี ถ้าไม่มีให้สร้างเอง
    const fileName = slipFile.filename || `${Date.now()}-${slipFile.originalname}`;

    console.log("[DEBUG] ชื่อไฟล์ที่ใช้บันทึก:", fileName);

    conn = await db.getConnection();

    // 1. สร้าง Booker
    const bookerResult = await conn.execute(
      `INSERT INTO Booker (BookerID, BName, BPhone, BEmail)
       VALUES (Booker_SEQ.NEXTVAL, :bname, :bphone, :bemail)
       RETURNING BookerID INTO :outBookerId`,
      {
        bname: fullName,
        bphone: phone,
        bemail: email,
        outBookerId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const bookerId = bookerResult.outBinds.outBookerId[0];

    // 2. สร้าง Booking
    const bookingResult = await conn.execute(
      `INSERT INTO Booking (BookingID, BKStatus, BKDate, BookerID, RoomID)
       VALUES (Booking_SEQ.NEXTVAL, 'WAITING_VERIFY', SYSDATE, :bookerId, :roomId)
       RETURNING BookingID INTO :outBookingId`,
      {
        bookerId,
        roomId,
        outBookingId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    const bookingId = bookingResult.outBinds.outBookingId[0];
    // 3. สร้าง Payment (บันทึกชื่อไฟล์จริง)
    await conn.execute(
      `INSERT INTO Payment
         (PayID, BillID, PayStatus, PayDate, PayFiles, PayAmount, BookingID, BookerID, RoomID, PayType)
       VALUES
         (Payment_SEQ.NEXTVAL, NULL, 'WAITING_VERIFY', SYSDATE, :payFiles, 5500, :bookingId, :bookerId, :roomId, 'DEPOSIT')`,
      {
        payFiles: fileName,  // ใช้ fileName ที่สร้างไว้
        bookingId,
        bookerId,
        roomId
      }
    );

    await conn.commit();

    console.log("[SUCCESS] บันทึกการจองสำเร็จ");
    console.log(" - BookerID:", bookerId);
    console.log(" - BookingID:", bookingId);
    console.log(" - PAYFILES:", fileName);

    res.json({ success: true, bookingId, message: "จองสำเร็จ รอตรวจสอบสลิป" });

  } catch (err) {
    console.error("[ERROR] createBooking:", err);
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาดในการจอง" });
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
  p.PayID,
  p.PayFiles,
  bk.BName AS BNAME,
  bk.BPhone AS BPHONE,
  bk.BEmail AS BEMAIL
FROM Booking b
JOIN Booker bk ON b.BookerID = bk.BookerID
LEFT JOIN Payment p ON p.BookingID = b.BookingID
WHERE b.BKStatus IN ('WAITING_VERIFY','APPROVED')
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

    // ดึงข้อมูล RoomID และรายละเอียดผู้จอง (Booker) เพื่อนำไปสร้าง Account & Member
    const roomRes = await conn.execute(
      `SELECT b.RoomID, bk.BName, bk.BPhone, bk.BEmail 
       FROM Booking b 
       JOIN Booker bk ON b.BookerID = bk.BookerID 
       WHERE b.BookingID = :bookingId`,
      { bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (roomRes.rows.length === 0) return res.status(404).json({ success: false, message: "ไม่พบคำจอง" });

    const row = roomRes.rows[0];
    const roomId = row.ROOMID;
    const bName = row.BNAME;
    const bPhone = row.BPHONE;
    const bEmail = row.BEMAIL;

    console.log('[approveBooking] roomId:', roomId, '| bName:', bName, '| bPhone:', bPhone);

    // 1. ตรวจสอบว่ามี Account ของห้องนี้ที่ยัง Active อยู่ไหม ถ้ามีให้ Deactivate ก่อน (ป้องกันข้อผิดพลาด)
    await conn.execute(`UPDATE Account SET is_active = 0 WHERE RoomID = :roomId AND is_active = 1`, { roomId });

    // 2. สร้าง Account ใหม่ (Username: roomXXX, Password: เบอร์โทร)
    const accUser = `room${roomId}`;
    const accPass = bPhone || '123456';

    // ดึง SEQ ให้ถูกต้อง โดยใส่ outFormat เพื่อให้ได้ object format
    const seqCheck = await conn.execute(
      `SELECT Account_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const accId = seqCheck.rows[0].SEQ;
    console.log('[approveBooking] accId from SEQ:', accId);

    if (!accId) {
      throw new Error("ระบบฐานข้อมูลไม่สามารถสร้างรหัสบัญชีได้ (SEQ ERROR)");
    }

    await conn.execute(
      `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, is_active)
       VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
      { accId, accUser, accPass, roomId }
    );
    console.log('[approveBooking] Account inserted OK, accId:', accId);

    // 3. สร้าง Member ผูกกับ Account
    await conn.execute(
      `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
       VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
      { memName: bName, memPhone: bPhone, memEmail: bEmail || null, accId, roomId }
    );
    console.log('[approveBooking] Member inserted OK');

    // 4. อัปเดตสถานะ Booking, Room และ Payment
    await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :bookingId`, { bookingId });
    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE RoomID = :roomId`, { roomId });
    await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :bookingId`, { bookingId });

    await conn.commit();
    console.log('[approveBooking] commit OK!');
    res.json({ success: true, message: "อนุมัติและสร้างบัญชีผู้ใช้สำเร็จ!" });
  } catch (err) {
    console.error('[approveBooking] ERROR:', err);
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
      `SELECT b.BookingID, bk.BName, bk.BPhone, bk.BEmail 
       FROM Booking b 
       JOIN Booker bk ON b.BookerID = bk.BookerID 
       WHERE b.ROOMID = :roomId AND b.BKSTATUS = 'WAITING_VERIFY' 
       ORDER BY b.BKDATE ASC`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (bookings.rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่มีคำขอรอตรวจสอบ" });
    }

    // Process only the first booking in the auto-approve queue to create the Account
    for (let i = 0; i < bookings.rows.length; i++) {
      const row = bookings.rows[i];
      const bookingId = row.BOOKINGID;

      if (i === 0) {
        const bName = row.BNAME;
        const bPhone = row.BPHONE;
        const bEmail = row.BEMAIL;

        await conn.execute(`UPDATE Account SET is_active = 0 WHERE RoomID = :roomId AND is_active = 1`, { roomId });

        const accUser = `room${roomId}`;
        const accPass = bPhone || '123456';

        const seqCheck = await conn.execute(
          `SELECT Account_SEQ.NEXTVAL AS SEQ FROM DUAL`,
          {},
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const accId = seqCheck.rows[0].SEQ;
        console.log('[autoApprove] accId:', accId);

        if (!accId) {
          throw new Error("ไม่สามารถสร้างรหัสบัญชี (SEQ ERROR)");
        }

        await conn.execute(
          `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, is_active)
           VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
          { accId, accUser, accPass, roomId }
        );
        console.log('[autoApprove] Account inserted OK');

        await conn.execute(
          `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
           VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
          { memName: bName, memPhone: bPhone, memEmail: bEmail || null, accId, roomId }
        );
        console.log('[autoApprove] Member inserted OK');
      }

      await conn.execute(`UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :id`, { id: bookingId });
      await conn.execute(`UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :id`, { id: bookingId });
    }

    await conn.execute(`UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE ROOMID = :roomId`, { roomId });
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
