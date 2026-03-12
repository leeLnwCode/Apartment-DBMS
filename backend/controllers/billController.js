const { getConnection } = require('../db');

exports.createBill = async (req, res) => {
  const { roomId, waterUnit, electricUnit, waterCost, electricCost, billMonth, billYear } = req.body;
  if (!roomId || waterUnit == null || electricUnit == null || waterCost == null || electricCost == null || !billMonth || !billYear) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  const water = Number(waterUnit) || 0;
  const electric = Number(electricUnit) || 0;
  const wCost = Number(waterCost) || 0;
  const eCost = Number(electricCost) || 0;
  let connection;

  try {
    connection = await getConnection();

    const unpaidCheck = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM BILL WHERE ROOMID = :roomId AND STATUS = 'UNPAID' AND IS_DELETED = 0`,
      { roomId: roomId }
    );
    if (unpaidCheck.rows[0].CNT > 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถออกบิลใหม่ได้ เนื่องจากยังมีบิลที่ค้างชำระ (หรือรอตรวจสอบ) สำหรับห้องนี้'
      });
    }

    const roomResult = await connection.execute(
      `SELECT RPRICE FROM ROOM WHERE ROOMID = :roomId`,
      { roomId: roomId }
    );

    if (roomResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลห้อง' });
    }

    const roomPrice = roomResult.rows[0].RPRICE;
    const totalAmount = roomPrice + (water * wCost) + (electric * eCost);

    const accResult = await connection.execute(
      `SELECT ACCID FROM ACCOUNT WHERE ROOMID = :roomId AND IS_ACTIVE = 1`,
      { roomId: roomId }
    );

    if (accResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบ ACCOUNT สำหรับห้องนี้' });
    }

    const accId = accResult.rows[0].ACCID;
    const month = Number(billMonth);
    const year = Number(billYear);

    let nextMonth = month;
    let nextYear = year;

    if (nextMonth === 12) {
      nextMonth = 1;
      nextYear++;
    } else {
      nextMonth++;
    }

    const dueDate = new Date(nextYear, nextMonth - 1, 5);

    await connection.execute(
      `INSERT INTO BILL (
        BILLID,
        WATERUNIT, ELECTRICUNIT, WATERCOST, ELECTRICCOST, TOTALAMOUNT,
        ACCID, ROOMID, STATUS, BILLMONTH, BILLYEAR, DUEDATE, IS_DELETED
      )
      VALUES (
        BILL_SEQ.NEXTVAL,
        :waterUnit, :electricUnit, :waterCost, :electricCost, :totalAmount,
        :accId, :roomId, 'UNPAID', :billMonth, :billYear, :dueDate, 0
      )`,
      {
        waterUnit: water,
        electricUnit: electric,
        waterCost: wCost,
        electricCost: eCost,
        totalAmount: totalAmount,
        accId: accId,
        roomId: roomId,
        billMonth: month,
        billYear: year,
        dueDate: dueDate
      }
    );

    await connection.commit();
    res.json({ success: true, message: 'สร้างบิลสำเร็จ' });

  } catch (err) {
    console.error("Create bill error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.getAllBills = async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT BILLID, ROOMID, WATERUNIT, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE IS_DELETED = 0
       ORDER BY BILLID DESC`
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

exports.getBillsByRoom = async (req, res) => {
  const { roomId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT BILLID, WATERUNIT, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE ROOMID = :roomId AND IS_DELETED = 0
       ORDER BY BILLID DESC`,
      { roomId: roomId }
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

exports.getBillsByAccId = async (req, res) => {
  const { accId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT BILLID, WATERUNIT, ROOMID, ELECTRICUNIT, WATERCOST, ELECTRICCOST,
              TOTALAMOUNT, STATUS, BILLMONTH, BILLYEAR, DUEDATE
       FROM BILL
       WHERE ACCID = :accId AND IS_DELETED = 0
       ORDER BY BILLID DESC`,
      { accId: Number(accId) }
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("getBillsByAccId error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.updateBill = async (req, res) => {
  const { billId } = req.params;
  const { roomId, waterUnit, electricUnit, waterCost, electricCost, billMonth, billYear } = req.body;

  if (!roomId || waterUnit == null || electricUnit == null || waterCost == null || electricCost == null || !billMonth || !billYear) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  const water = Number(waterUnit) || 0;
  const electric = Number(electricUnit) || 0;
  const wCost = Number(waterCost) || 0;
  const eCost = Number(electricCost) || 0;

  const monthMap = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12
  };

  const month = monthMap[billMonth] || Number(billMonth);
  const year = Number(billYear);

  if (isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ success: false, message: 'เดือนไม่ถูกต้อง' });
  }

  let connection;
  try {
    connection = await getConnection();
    const roomResult = await connection.execute(`SELECT RPRICE FROM ROOM WHERE ROOMID = :roomId`, { roomId: roomId });
    if (roomResult.rows.length === 0) return res.status(400).json({ success: false, message: "ไม่พบข้อมูลห้อง" });
    const roomPrice = roomResult.rows[0].RPRICE;
    const totalAmount = roomPrice + (water * wCost) + (electric * eCost);

    let nextMonth = month === 12 ? 1 : month + 1;
    let nextYear = month === 12 ? year + 1 : year;
    const dueDate = new Date(nextYear, nextMonth - 1, 5);

    const result = await connection.execute(
      `UPDATE BILL SET
        WATERUNIT = :waterUnit,
        ELECTRICUNIT = :electricUnit,
        WATERCOST = :waterCost,
        ELECTRICCOST = :electricCost,
        TOTALAMOUNT = :totalAmount,
        ROOMID = :roomId,
        BILLMONTH = :billMonth,
        BILLYEAR = :billYear,
        DUEDATE = :dueDate
      WHERE BILLID = :billId`,
      {
        waterUnit: water,
        electricUnit: electric,
        waterCost: wCost,
        electricCost: eCost,
        totalAmount: totalAmount,
        roomId: roomId,
        billMonth: month,
        billYear: year,
        dueDate: dueDate,
        billId: Number(billId)
      }
    );

    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "ไม่พบบิลที่ต้องการแก้ไข" });

    await connection.commit();
    res.json({ success: true, message: "แก้ไขบิลสำเร็จ" });
  } catch (err) {
    console.error("Update bill error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.payBill = async (req, res) => {
  const { billId } = req.body;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(`UPDATE BILL SET STATUS = 'PAID' WHERE BILLID = :billId`, { billId: Number(billId) });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: 'ไม่พบบิล' });
    await connection.commit();
    res.json({ success: true, message: 'ชำระเงินสำเร็จ' });
  } catch (err) {
    console.error("payBill error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.deleteBill = async (req, res) => {
  const { billId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(`UPDATE BILL SET IS_DELETED = 1 WHERE BILLID = :billId`, { billId: Number(billId) });
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, message: "ไม่พบบิล" });
    await connection.commit();
    res.json({ success: true, message: "ลบบิลสำเร็จ" });
  } catch (err) {
    console.error("deleteBill error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.getLastBillByRoom = async (req, res) => {
  const { roomId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT WATERUNIT, ELECTRICUNIT
       FROM BILL
       WHERE ROOMID = :roomId
       ORDER BY BILLID DESC
       FETCH FIRST 1 ROWS ONLY`,
      { roomId: roomId }
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: { water: 0, elec: 0 } });
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
