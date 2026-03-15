const { getConnection } = require('../db');
const oracledb = require('oracledb');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

exports.createBooking = async (req, res) => {
  let conn;
  try {
    const { roomId, fullName, phone, email } = req.body;
    const slipFile = req.file;

    if (!roomId || !fullName || !phone || !email || !slipFile) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลและอัปโหลดสลิป" });
    }

    const fileName = slipFile.filename || `${Date.now()}-${slipFile.originalname}`;

    conn = await getConnection();

    const pendingCheck = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM Booking WHERE RoomID = :roomId AND BKStatus = 'WAITING_VERIFY'`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (pendingCheck.rows[0].CNT > 0) {
      return res.status(400).json({
        success: false,
        message: 'ห้องนี้มีรายการจองที่รอการตรวจสอบอยู่แล้ว ไม่สามารถจองซ้ำได้'
      });
    }

    const bookerSeq = await conn.execute(
      `SELECT BOOKER_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookerId = bookerSeq.rows[0].SEQ;

    await conn.execute(
      `INSERT INTO Booker (BookerID, BName, BPhone, BEmail) VALUES (:bid, :bname, :bphone, :bemail)`,
      { bid: bookerId, bname: fullName, bphone: phone, bemail: email }
    );

    const bookingSeq = await conn.execute(
      `SELECT BOOKING_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const bookingId = bookingSeq.rows[0].SEQ;

    await conn.execute(
      `INSERT INTO Booking (BookingID, BKStatus, BKDate, BookerID, RoomID)
       VALUES (:bid, 'WAITING_VERIFY', CURRENT_TIMESTAMP, :bookerId, :roomId)`,
      { bid: bookingId, bookerId, roomId }
    );

    const paymentSeq = await conn.execute(
      `SELECT PAYMENT_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const payId = paymentSeq.rows[0].SEQ;

    await conn.execute(
      `INSERT INTO Payment
         (PayID, PayStatus, PayDate, PayFiles, PayAmount, BookingID, BookerID, RoomID, PayType)
       VALUES
         (:pid, 'WAITING_VERIFY', CURRENT_TIMESTAMP, :payFiles, 5500, :bookingId, :bookerId, :roomId, 'DEPOSIT')`,
      { pid: payId, payFiles: fileName, bookingId, bookerId, roomId }
    );

    await conn.commit();
    res.json({ success: true, bookingId, message: "จองสำเร็จ รอตรวจสอบสลิป" });

  } catch (err) {
    console.error("createBooking error:", err);
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาดในการจอง" });
  } finally {
    if (conn) await conn.close();
  }
};

exports.getAllBookings = async (req, res) => {
  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT
        b.BookingID,
        b.BKStatus,
        b.BKDate,
        b.RoomID,
        p.PayID,
        p.PayFiles,
        bk.BName  AS BNAME,
        bk.BPhone AS BPHONE,
        bk.BEmail AS BEMAIL
       FROM Booking b
       JOIN Booker bk ON b.BookerID = bk.BookerID
       LEFT JOIN Payment p ON p.BookingID = b.BookingID
       WHERE b.BKStatus IN ('WAITING_VERIFY','APPROVED')
       ORDER BY b.BookingID DESC`,
      [],
      // แก้ไข: เพิ่ม OUT_FORMAT_OBJECT เพื่อให้ row.BNAME, row.ROOMID ทำงานได้ถูกต้อง
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);

  } catch (err) {
    console.error("getAllBookings error:", err);
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาดในการดึงคำจอง" });
  } finally {
    if (conn) await conn.close();
  }
};

exports.approveBooking = async (req, res) => {
  let conn;
  try {
    const { bookingId } = req.params;
    conn = await getConnection();

    const roomRes = await conn.execute(
      `SELECT b.RoomID, bk.BName, bk.BPhone, bk.BEmail
       FROM Booking b
       JOIN Booker bk ON b.BookerID = bk.BookerID
       WHERE b.BookingID = :bookingId`,
      { bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (roomRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบคำจอง" });
    }

    const row    = roomRes.rows[0];
    const roomId = row.ROOMID;
    const bName  = row.BNAME;
    const bPhone = row.BPHONE;
    const bEmail = row.BEMAIL;

    await conn.execute(
      `UPDATE Account SET IS_ACTIVE = 0 WHERE RoomID = :roomId AND IS_ACTIVE = 1`,
      { roomId }
    );

    const accUser = `room${roomId}`;

    // แก้ไข: hash รหัสผ่านก่อนเก็บ
    const rawPass   = bPhone || '123456';
    const hashedPass = await bcrypt.hash(rawPass, SALT_ROUNDS);

    const accSeq = await conn.execute(
      `SELECT ACCOUNT_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const accId = accSeq.rows[0].SEQ;

    await conn.execute(
      `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, IS_ACTIVE)
       VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
      { accId, accUser, accPass: hashedPass, roomId }
    );

    // แก้ไข: ดึง MEMID จาก sequence ก่อน INSERT (สาเหตุหลักของ ORA-01400)
    const memSeq = await conn.execute(
      `SELECT MEMBER_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const memId = memSeq.rows[0].SEQ;

    await conn.execute(
      `INSERT INTO MEMBER (MEMID, MEMNAME, MEMPHONE, MEMEMAIL, ACCID, ROOMID)
       VALUES (:memId, :memName, :memPhone, :memEmail, :accId, :roomId)`,
      {
        memId,
        memName:  bName,
        memPhone: bPhone,
        memEmail: bEmail || null,
        accId,
        roomId
      }
    );

    await conn.execute(
      `UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :bookingId`,
      { bookingId }
    );
    await conn.execute(
      `UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE RoomID = :roomId`,
      { roomId }
    );
    await conn.execute(
      `UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :bookingId`,
      { bookingId }
    );

    await conn.commit();
    res.json({ success: true, message: "อนุมัติและสร้างบัญชีผู้ใช้สำเร็จ!" });

  } catch (err) {
    console.error('approveBooking error:', err);
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

exports.checkPendingForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT COUNT(*) AS CNT FROM Booking WHERE ROOMID = :roomId AND BKSTATUS = 'WAITING_VERIFY'`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const hasPending = result.rows[0].CNT > 0;
    res.json({ hasPending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

exports.autoApproveForRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await getConnection();

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

    for (let i = 0; i < bookings.rows.length; i++) {
      const row       = bookings.rows[i];
      const bookingId = row.BOOKINGID;

      if (i === 0) {
        const bName  = row.BNAME;
        const bPhone = row.BPHONE;
        const bEmail = row.BEMAIL;

        await conn.execute(
          `UPDATE Account SET IS_ACTIVE = 0 WHERE RoomID = :roomId AND IS_ACTIVE = 1`,
          { roomId }
        );

        const accUser    = `room${roomId}`;
        // แก้ไข: hash รหัสผ่าน
        const rawPass    = bPhone || '123456';
        const hashedPass = await bcrypt.hash(rawPass, SALT_ROUNDS);

        const accSeq = await conn.execute(
          `SELECT ACCOUNT_SEQ.NEXTVAL AS SEQ FROM DUAL`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const accId = accSeq.rows[0].SEQ;

        await conn.execute(
          `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, IS_ACTIVE)
           VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
          { accId, accUser, accPass: hashedPass, roomId }
        );

        const memSeq = await conn.execute(
          `SELECT MEMBER_SEQ.NEXTVAL AS SEQ FROM DUAL`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const memId = memSeq.rows[0].SEQ;

        // แก้ไข: ชื่อ column MEMID (ไม่ใช่ MemberID)
        await conn.execute(
          `INSERT INTO Member (MEMID, MEMNAME, MEMPHONE, MEMEMAIL, ACCID, ROOMID)
           VALUES (:memId, :memName, :memPhone, :memEmail, :accId, :roomId)`,
          { memId, memName: bName, memPhone: bPhone, memEmail: bEmail || null, accId, roomId }
        );
      }

      await conn.execute(
        `UPDATE Booking SET BKStatus = 'APPROVED' WHERE BookingID = :id`,
        { id: bookingId }
      );
      await conn.execute(
        `UPDATE Payment SET PayStatus = 'VERIFIED' WHERE BookingID = :id`,
        { id: bookingId }
      );
    }

    await conn.execute(
      `UPDATE Room SET RSTATUS = 'OCCUPIED' WHERE ROOMID = :roomId`,
      { roomId }
    );
    await conn.commit();
    res.json({ success: true, approvedCount: bookings.rows.length, message: "อนุมัติอัตโนมัติและสร้างบัญชีสำเร็จ!" });

  } catch (err) {
    console.error("autoApprove error:", err);
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

exports.getSlipByBookingId = async (req, res) => {
  let conn;
  try {
    const { bookingId } = req.params;
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT PayFiles FROM Payment WHERE BookingID = :bookingId`,
      { bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length === 0) return res.status(404).send("ไม่พบสลิป");
    res.setHeader("Content-Type", "image/jpeg");
    res.send(result.rows[0].PAYFILES);
  } catch (err) {
    res.status(500).send(err.message);
  } finally {
    if (conn) await conn.close();
  }
};