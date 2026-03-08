const db = require("../db");
const oracledb = require("oracledb");

// -------------------------------------------------------
// GET ALL PAYMENTS  (Admin)
// -------------------------------------------------------
exports.getAllPayments = async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID,
              BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES, PAYTYPE
         FROM PAYMENT
        ORDER BY PAYDATE DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error("getAllPayments error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// -------------------------------------------------------
// CREATE PAYMENT
//   payType: 'DEPOSIT' = ค่ามัดจำ (BillID = NULL ได้)
//            'RENT'    = ค่าเช่า/น้ำ/ไฟ (ต้องมี BillID)
// -------------------------------------------------------
function toNumberOrNull(value) {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

exports.createPayment = async (req, res) => {
  // หาไฟล์จากหลายชื่อ field
  const file = req.file || req.files?.payFile || req.files?.slip || req.files?.file;
  const payFile = file ? file.filename : null;

  console.log("[DEBUG] req.file:", req.file);
  console.log("[DEBUG] payFile ที่บันทึก:", payFile);

  const { billId, payAmount, roomId, accId, bookerId, bookingId, payType } = req.body;

  const parsedPayAmount = Number(String(payAmount).replace(/[^0-9.]/g, '')) || 0;
  if (parsedPayAmount <= 0) {
    return res.status(400).json({ success: false, message: 'payAmount ไม่ถูกต้อง' });
  }

  const type = payType || 'RENT';

  if (type === 'RENT' && !billId) {
    return res.status(400).json({ success: false, message: 'การชำระค่าเช่าต้องระบุ billId' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    const bindVars = {
      payAmount: parsedPayAmount,
      roomId: roomId || null,
      billId: type === 'DEPOSIT' ? null : toNumberOrNull(billId),
      accId: toNumberOrNull(accId),
      bookerId: toNumberOrNull(bookerId),
      bookingId: toNumberOrNull(bookingId),
      payFile,
      payType: type
    };

    await conn.execute(
      `INSERT INTO PAYMENT
         (PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID, BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES, PAYTYPE)
       VALUES
         (PAY_SEQ.NEXTVAL, 'PAID', SYSDATE, :payAmount, :roomId, :billId, :accId, :bookerId, :bookingId, :payFile, :payType)`,
      bindVars
    );

    if (bindVars.billId) {
      await conn.execute(
        `UPDATE BILL SET STATUS = 'PAID' WHERE BILLID = :billId`,
        { billId: bindVars.billId }
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'บันทึกการชำระเงินสำเร็จ', payFile });

  } catch (err) {
    console.error("createPayment error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// -------------------------------------------------------
// GET SLIP
// -------------------------------------------------------
exports.getSlip = async (req, res) => {
  let conn;
  try {
    const payId = req.params.payId;
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT PAYFILES FROM PAYMENT WHERE PAYID = :payId`,
      { payId }
    );
    if (result.rows.length === 0) return res.status(404).send("ไม่พบสลิป");

    const filename = result.rows[0][0];
    if (!filename) return res.status(404).send("ไม่มีไฟล์สลิป");

    res.sendFile(path.join(__dirname, '../uploads/slips', filename));

  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  } finally {
    if (conn) await conn.close();
  }
};

// -------------------------------------------------------
// GET PAYMENTS BY ROOM
// -------------------------------------------------------
exports.getPaymentsByRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID,
              BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES, PAYTYPE
         FROM PAYMENT
        WHERE ROOMID = :roomId
        ORDER BY PAYDATE DESC`,
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
      PAYFILES: r.PAYFILES,
      PAYTYPE: r.PAYTYPE
    }));

    res.json({ success: true, data: payments });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

// -------------------------------------------------------
// GET PAYMENTS BY ACCID  (ลูกบ้าน — เฉพาะ RENT)
// -------------------------------------------------------
exports.getPaymentsByAccId = async (req, res) => {
  let conn;
  try {
    const accId = req.params.accId;
    conn = await db.getConnection();

    const result = await conn.execute(
      `SELECT PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID, BILLID, ACCID, PAYFILES, PAYTYPE
         FROM PAYMENT
        WHERE ACCID    = :accId
          AND PAYTYPE  = 'RENT'
        ORDER BY PAYDATE DESC`,
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
      PAYFILES: r.PAYFILES,
      PAYTYPE: r.PAYTYPE
    }));

    res.json({ success: true, data: payments });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

