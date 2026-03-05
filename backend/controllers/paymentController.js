const db = require("../db");
const oracledb = require("oracledb");
const multer = require('multer');
const path = require('path');

// Config multer สำหรับอัปโหลดสลิป
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/slips/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ดึง payment ทั้งหมด (สำหรับหน้า admin ดูว่าใครจ่าย/ไม่จ่าย)
exports.getAllPayments = async (req, res) => {

  let conn;

  try {

    conn = await db.getConnection();

    const result = await conn.execute(
      `
      SELECT 
        PAYID,
        PAYSTATUS,
        PAYDATE,
        PAYAMOUNT,
        ROOMID,
        BILLID,
        ACCID,
        BOOKERID,
        BOOKINGID,
        PAYFILES
      FROM PAYMENT
      ORDER BY PAYDATE DESC
      `,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {

    console.error("getAllPayments error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  } finally {

    if (conn) await conn.close();

  }

};
function toNumberOrNull(value) {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

exports.createPayment = async (req, res) => {

  const { billId, payAmount, roomId, accId, bookerId, bookingId } = req.body;
  const payFile = req.file ? req.file.filename : null;

  console.log("[createPayment] Received raw:", req.body);

  const parsedPayAmount = Number(String(payAmount).replace(/[^0-9.]/g, '')) || 0;

  if (isNaN(parsedPayAmount) || parsedPayAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'payAmount ไม่ถูกต้อง'
    });
  }

  let conn;

  try {

    conn = await db.getConnection();

    const bindVars = {
      payAmount: parsedPayAmount,
      roomId: roomId || null,
      billId: toNumberOrNull(billId),
      accId: toNumberOrNull(accId),
      bookerId: toNumberOrNull(bookerId),
      bookingId: toNumberOrNull(bookingId),
      payFile
    };

    console.log("[createPayment] Bind vars:", bindVars);

    // 1️⃣ insert payment
    await conn.execute(
`INSERT INTO PAYMENT (
  PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID, BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES
) VALUES (
  PAY_SEQ.NEXTVAL, 'PAID', SYSDATE, :payAmount, :roomId, :billId, :accId, :bookerId, :bookingId, :payFile
)`,
      bindVars
    );

    // 2️⃣ update bill
   if (bindVars.billId) {
  await conn.execute(
    `UPDATE BILL SET STATUS='PAID' WHERE BILLID = :billId`,
    { billId: bindVars.billId }
  );
}

    await conn.commit();

    res.json({
      success: true,
      message: 'บันทึกการชำระเงินสำเร็จ'
    });

  } catch (err) {

    console.error("[createPayment] Error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  } finally {

    if (conn) await conn.close();

  }

};

// ดึงสลิป (ปรับให้ใช้ PAYID แทน BookingID)
exports.getSlip = async (req, res) => {
 
  let conn;
 
  try {
    const payId = req.params.payId;   // เปลี่ยนจาก bookingId เป็น payId

    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT PAYFILES FROM PAYMENT WHERE PAYID = :payId`,
      { payId }
    );

    if (result.rows.length === 0) {
      return res.status(404).send("ไม่พบสลิป");
    }

    const filename = result.rows[0][0];
    if (!filename) return res.status(404).send("ไม่มีไฟล์สลิป");

    res.sendFile(path.join(__dirname, '../uploads/slips', filename));

  } catch (err) {
  
    console.error(err);
    res.status(500).send(err.message);
  } 
  finally {
    if (conn) await conn.close();
  }
};

exports.upload = upload;  // ส่ง multer ไปใช้ใน route

exports.getPaymentsByRoom = async (req, res) => {

  let conn;

  try {

    const { roomId } = req.params;

    conn = await db.getConnection();

    const result = await conn.execute(
      `
      SELECT 
        PAYID,
        PAYSTATUS,
        PAYDATE,
        PAYAMOUNT,
        ROOMID,
        BILLID,
        ACCID,
        BOOKERID,
        BOOKINGID,
        PAYFILES
      FROM PAYMENT
      WHERE ROOMID = :roomId
      ORDER BY PAYDATE DESC
      `,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const payments = result.rows.map(r => ({
      PAYID: r.PAYID,
      PAYSTATUS: r.PAYSTATUS,
      PAYDATE: r.PAYDATE ? r.PAYDATE.toISOString() : null,
      PAYAMOUNT: r.PAYAMOUNT,
      ROOMID: r.ROOMID,
      BILLID: r.BILLID,
      ACCID: r.ACCID,
      BOOKERID: r.BOOKERID,
      BOOKINGID: r.BOOKINGID,
      PAYFILES: r.PAYFILES
    }));

    return res.json({
      success: true,
      data: payments
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message
    });

  } finally {

    if (conn) await conn.close();

  }
};

// ดึง payment ของลูกบ้านเท่านั้น (ใช้ ACCID)
exports.getPaymentsByAccId = async (req, res) => {

  let conn;

  try {

    const accId = req.params.accId;

    conn = await db.getConnection();

    const result = await conn.execute(
      `
      SELECT 
        PAYID,
        PAYSTATUS,
        PAYDATE,
        PAYAMOUNT,
        ROOMID,
        BILLID,
        ACCID,
        PAYFILES
      FROM PAYMENT
      WHERE ACCID = :accId
      ORDER BY PAYDATE DESC
      `,
      { accId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

   const payments = result.rows.map(r => ({
  PAYID: r.PAYID,
  PAYSTATUS: r.PAYSTATUS,
  PAYDATE: r.PAYDATE ? new Date(r.PAYDATE).toISOString() : null,
  PAYAMOUNT: r.PAYAMOUNT,
  ROOMID: r.ROOMID,
  BILLID: r.BILLID,
  ACCID: r.ACCID,
  PAYFILES: r.PAYFILES
}));
res.json({
  success: true,
  data: payments
});

  } catch (err) {

    console.error(err);
    res.status(500).json({ success: false, message: err.message });

  } finally {

    if (conn) await conn.close();

  }

};