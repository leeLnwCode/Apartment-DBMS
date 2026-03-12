const { getConnection } = require('../db');

exports.getAllPayments = async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID,
              BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES, PAYTYPE
         FROM PAYMENT
        ORDER BY PAYDATE DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getAllPayments error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

function toNumberOrNull(value) {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

exports.createPayment = async (req, res) => {
  const file = req.file || (req.files ? (req.files.payFile || req.files.slip || req.files.file) : null);
  const payFile = file ? file.filename : null;

  const { billId, payAmount, roomId, accId, bookerId, bookingId, payType } = req.body;
  const parsedPayAmount = Number(String(payAmount).replace(/[^0-9.]/g, '')) || 0;

  if (parsedPayAmount <= 0) return res.status(400).json({ success: false, message: 'payAmount ไม่ถูกต้อง' });

  const type = payType || 'RENT';
  if (type === 'RENT' && !billId) return res.status(400).json({ success: false, message: 'การชำระค่าเช่าต้องระบุ billId' });

  let conn;
  try {
    conn = await getConnection();
    const bindVars = {
      payAmount: parsedPayAmount,
      roomId: roomId || null,
      billId: type === 'DEPOSIT' ? null : toNumberOrNull(billId),
      accId: toNumberOrNull(accId),
      bookerId: toNumberOrNull(bookerId),
      bookingId: toNumberOrNull(bookingId),
      payFile: payFile,
      payType: type
    };

    await conn.execute(
      `INSERT INTO PAYMENT
         (PAYID, PAYSTATUS, PAYDATE, PAYAMOUNT, ROOMID, BILLID, ACCID, BOOKERID, BOOKINGID, PAYFILES, PAYTYPE)
       VALUES
         (PAYMENT_SEQ.NEXTVAL, 'PAID', CURRENT_TIMESTAMP, :payAmount, :roomId, :billId, :accId, :bookerId, :bookingId, :payFile, :payType)`,
      bindVars
    );

    if (bindVars.billId) {
      await conn.execute(`UPDATE BILL SET STATUS = 'PAID' WHERE BILLID = :billId`, { billId: bindVars.billId });
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

exports.getSlip = async (req, res) => {
  let conn;
  try {
    const payId = req.params.payId;
    conn = await getConnection();
    const result = await conn.execute(`SELECT PAYFILES FROM PAYMENT WHERE PAYID = :payId`, { payId: payId });
    if (result.rows.length === 0) return res.status(404).send("ไม่พบสลิป");
    const filename = result.rows[0].PAYFILES;
    if (!filename) return res.status(404).send("ไม่มีไฟล์สลิป");

    res.json({ filename });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  } finally {
    if (conn) await conn.close();
  }
};

exports.getPaymentsByRoom = async (req, res) => {
  let conn;
  try {
    const { roomId } = req.params;
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT * FROM PAYMENT WHERE ROOMID = :roomId ORDER BY PAYDATE DESC`,
      { roomId: roomId }
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};

exports.getPaymentsByAccId = async (req, res) => {
  let conn;
  try {
    const accId = req.params.accId;
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT * FROM PAYMENT WHERE ACCID = :accId AND PAYTYPE = 'RENT' ORDER BY PAYDATE DESC`,
      { accId: accId }
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) await conn.close();
  }
};
