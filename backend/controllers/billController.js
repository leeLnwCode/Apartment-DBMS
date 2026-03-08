// controllers/billController.js
const db = require('../db');
const oracledb = require('oracledb');
/* ===========================
   CREATE BILL
=========================== */
exports.createBill = async (req, res) => {
  const { roomId, waterUnit, electricUnit, waterCost, electricCost, billMonth, billYear } = req.body;
  if (!roomId || waterUnit == null || electricUnit == null || waterCost == null || electricCost == null || !billMonth || !billYear) {
    return res.status(400).json({
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    });
  }

  const water = Number(waterUnit) || 0;
  const electric = Number(electricUnit) || 0;
  const wCost = Number(waterCost) || 0;
  const eCost = Number(electricCost) || 0;
  let connection;

  try {
    connection = await db.getConnection();


    // ดึงราคาห้องจาก ROOM
    const roomResult = await connection.execute(
      `SELECT RPRICE FROM ROOM WHERE ROOMID = :roomId`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (roomResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลห้อง'
      });
    }

    const roomPrice = roomResult.rows[0].RPRICE;

    const totalAmount =
      roomPrice +
      (water * wCost) +
      (electric * eCost);


    // หา ACCID จาก ROOMID
    const accResult = await connection.execute(
      `SELECT ACCID FROM ACCOUNT WHERE ROOMID = :roomId`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log("ACC QUERY RESULT:", accResult.rows);

    if (accResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบ ACCOUNT สำหรับห้องนี้'
      });
    }

    const accId = accResult.rows[0].ACCID;

    console.log("ACCID =", accId);

    // ดึง BILLID จาก sequence
    const seqResult = await connection.execute(
      `SELECT BILL_SEQ.NEXTVAL AS BILLID FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log("Sequence result:", seqResult.rows);

    const billId = seqResult.rows[0].BILLID;
    const month = Number(billMonth);
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'เดือนไม่ถูกต้อง (1-12)' });
    }
    const year = Number(billYear);
    console.log("Generated BILLID:", billId);
    console.log("waterUnit =", waterUnit);
    console.log("electricUnit =", electricUnit);
    console.log("waterCost =", waterCost);
    console.log("electricCost =", electricCost);

    console.log("water =", water);
    console.log("electric =", electric);
    console.log("wCost =", wCost);
    console.log("eCost =", eCost);
    console.log("month =", month);
    console.log("year =", year);

    await connection.execute(
      `INSERT INTO BILL (
    BILLID,
    WATERUNIT,
    ELECTRICUNIT,
    WATERCOST,
    ELECTRICCOST,
    TOTALAMOUNT,
    ACCID,
    ROOMID,
    STATUS, 
    BILLMONTH, 
    BILLYEAR,
    DUEDATE
  )
  VALUES (
    :BILLID,
    :WATERUNIT,
    :ELECTRICUNIT,
    :WATERCOST,
    :ELECTRICCOST,
    :TOTALAMOUNT,
    :ACCID,
    :ROOMID,
    'UNPAID', 
    :billMonth, 
    :billYear,
     ADD_MONTHS(
  TO_DATE(
    '05-' || LPAD(:billMonth,2,'0') || '-' || :billYear,
    'DD-MM-YYYY'
  ),
1)
  )`,
      {
        BILLID: billId,
        WATERUNIT: water,
        ELECTRICUNIT: electric,
        WATERCOST: wCost,
        ELECTRICCOST: eCost,
        TOTALAMOUNT: totalAmount,
        ACCID: accId,
        ROOMID: roomId,
        billMonth: month,
        billYear: year
      },
      { autoCommit: true }
    );

    res.json({
      success: true,
      message: 'สร้างบิลสำเร็จ',
      billId
    });

  } catch (err) {
    console.error("Create bill error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    if (connection) await connection.close();
  }
};

/* GET ALL BILLS (ADMIN) */
exports.getAllBills = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT BILLID, ROOMID, WATERUNIT, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE IS_DELETED = 0
       ORDER BY BILLID DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const bills = result.rows.map(row => ({
      billId: row.BILLID,
      roomId: row.ROOMID,
      waterUnit: row.WATERUNIT,
      electricUnit: row.ELECTRICUNIT,
      waterCost: row.WATERCOST,
      electricCost: row.ELECTRICCOST,
      totalAmount: row.TOTALAMOUNT,
      status: row.STATUS,
      BILLMONTH: row.BILLMONTH,
      BILLYEAR: row.BILLYEAR,
      dueDate: row.DUEDATE
    }));

    res.json({ success: true, data: bills });

  } catch (err) {
    console.error("getAllBills error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

/* GET BILLS BY ROOM */
exports.getBillsByRoom = async (req, res) => {
  const { roomId } = req.params;
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT BILLID, WATERUNIT, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE ROOMID = :roomId AND IS_DELETED = 0
       ORDER BY BILLID DESC`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const bills = result.rows.map(r => ({
      billId: r.BILLID,
      roomId: r.ROOMID,
      waterUnit: r.WATERUNIT,
      electricUnit: r.ELECTRICUNIT,
      waterCost: r.WATERCOST,
      electricCost: r.ELECTRICCOST,
      totalAmount: r.TOTALAMOUNT,
      status: r.STATUS,
      BILLMONTH: r.BILLMONTH,
      BILLYEAR: r.BILLYEAR,
      dueDate: r.DUEDATE
    }));

    res.json({ success: true, data: bills });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

/* MEMBER VIEW BY ACCID */
exports.getBillsByAccId = async (req, res) => {
  const { accId } = req.params;
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT BILLID, WATERUNIT, ROOMID, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE ACCID = :accId AND IS_DELETED = 0
       ORDER BY BILLID DESC`,
      { accId: Number(accId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error("getBillsByAccId error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

/* ===========================
   UPDATE BILL
=========================== */
/* ===========================
   UPDATE BILL
=========================== */
exports.updateBill = async (req, res) => {
  const { billId: paramBillId } = req.params;   // ดึงจาก :billId ใน route


  console.log("[UPDATE DEBUG] req.params.billId ที่ได้รับ:", paramBillId, "typeof:", typeof paramBillId);

  const billId = Number(paramBillId);
  if (isNaN(billId) || billId <= 0) {
    console.log("[UPDATE ERROR] BILLID ไม่ถูกต้อง:", paramBillId);
    return res.status(400).json({
      success: false,
      message: "BILLID ไม่ถูกต้อง (ต้องเป็นตัวเลขบวก)"
    });
  }

  const { roomId, waterUnit, electricUnit, waterCost, electricCost, billMonth, billYear } = req.body;

  if (!roomId || waterUnit == null || electricUnit == null || waterCost == null || electricCost == null || !billMonth || !billYear) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  const water = Number(waterUnit) || 0;
  const electric = Number(electricUnit) || 0;
  const wCost = Number(waterCost) || 0;
  const eCost = Number(electricCost) || 0;

  console.log("roomId ที่ได้รับจาก frontend:", roomId);

  const monthMap = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12
  };

  const month = monthMap[billMonth] || Number(billMonth);
  const year = Number(billYear);

  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ success: false, message: 'เดือนไม่ถูกต้อง (1-12 หรือชื่อเดือน)' });
  }

  if (isNaN(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ success: false, message: 'ปีไม่ถูกต้อง' });
  }

  let connection;

  try {
    connection = await db.getConnection();

    const roomResult = await connection.execute(
      `SELECT RPRICE FROM ROOM WHERE ROOMID = :roomId`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (roomResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่พบข้อมูลห้อง" });
    }

    const roomPrice = roomResult.rows[0].RPRICE;
    const totalAmount = roomPrice + (water * wCost) + (electric * eCost);

    console.log("กำลังอัปเดต BILLID:", billId);

    const result = await connection.execute(
      `UPDATE BILL SET
        WATERUNIT = :water,
        ELECTRICUNIT = :electric,
        WATERCOST = :wCost,
        ELECTRICCOST = :eCost,
        TOTALAMOUNT = :totalAmount,
        ROOMID = :roomId,
        BILLMONTH = :month,
        BILLYEAR = :year,
        DUEDATE = ADD_MONTHS(
          TO_DATE('05-' || LPAD(:month,2,'0') || '-' || :year, 'DD-MM-YYYY'), 1)
      WHERE BILLID = :billId`,
      {
        water,
        electric,
        wCost,
        eCost,
        totalAmount,
        roomId,
        month,
        year,
        billId   // number ชัวร์
      },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบบิลที่ต้องการแก้ไข" });
    }

    res.json({ success: true, message: "แก้ไขบิลสำเร็จ" });

  } catch (err) {
    console.error("Update bill error:", err);
    res.status(500).json({ success: false, message: err.message || "เกิดข้อผิดพลาด" });
  } finally {
    if (connection) await connection.close();
  }
};
/* ===========================
   PAY BILL
=========================== */
exports.payBill = async (req, res) => {
  const { billId } = req.body;
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `UPDATE BILL
       SET STATUS = 'PAID'
       WHERE BILLID = :billId`,
      { billId: Number(billId) },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบบิล'
      });
    }

    res.json({ success: true, message: 'ชำระเงินสำเร็จ' });

  } catch (err) {
    console.error("payBill error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    if (connection) await connection.close();
  }
};

exports.deleteBill = async (req, res) => {
  const { billId } = req.params;
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `UPDATE BILL 
       SET IS_DELETED = 1 
       WHERE BILLID = :billId AND IS_DELETED = 0`,  // ป้องกันลบซ้ำ
      { billId: Number(billId) },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบบิล หรือบิลนี้ถูกลบไปแล้ว"
      });
    }

    res.json({
      success: true,
      message: "ลบบิลสำเร็จ (ซ่อนจากรายการ)"
    });

  } catch (err) {
    console.error("deleteBill error:", err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    if (connection) await connection.close();
  }
};

exports.getLastBillByRoom = async (req, res) => {
  const { roomId } = req.params;
  let connection;

  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT WATERUNIT, ELECTRICUNIT
       FROM BILL
       WHERE ROOMID = :roomId
       ORDER BY BILLID DESC
       FETCH FIRST 1 ROWS ONLY`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { water: 0, elec: 0 }
      });
    }

    res.json({
      success: true,
      data: {
        water: result.rows[0].WATERUNIT,
        elec: result.rows[0].ELECTRICUNIT
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};