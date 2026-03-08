const oracledb = require('oracledb');
const db = require('../db');

// -------------------------------------------------------
// GET ALL USERS  (เฉพาะ Account ที่ใช้งานอยู่)
// -------------------------------------------------------
exports.getAllUsers = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT a.AccID, a.AccUser, a.AccPass, a.RoomID, 
              m.MemName, m.MemPhone, m.MemEmail
         FROM Account a
         LEFT JOIN Member m ON a.AccID = m.AccID
        WHERE a.is_active = 1
        ORDER BY a.RoomID ASC`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ success: true, users: result.rows });

  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงรายการผู้ใช้ได้' });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// CREATE USER
// -------------------------------------------------------
exports.createUser = async (req, res) => {
  const { roomId, accUser, accPass, memName, memPhone, memEmail } = req.body;

  if (!roomId || !accUser || !accPass || !memName || !memPhone) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน (ต้องการชื่อและเบอร์โทรลูกบ้านด้วย)' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    // ตรวจเฉพาะ Account ที่ is_active = 1 (Account เก่าที่ deactivate แล้วไม่นับ)
    const check = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE RoomID = :roomId AND is_active = 1`,
      { roomId }
    );
    if (check.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: `ห้อง ${roomId} มีผู้ใช้ที่ใช้งานอยู่แล้ว` });
    }

    // ตรวจ AccUser ซ้ำ (ตรวจทั้งหมด รวม inactive เพื่อกัน username ซ้ำ)
    const userCheck = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE AccUser = :accUser`,
      { accUser }
    );
    if (userCheck.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    // 1. ดึงค่า AccID ถัดไปจาก Sequence ออกมาก่อน (เพื่อความชัวร์ 100% ว่าไม่เป็น undefined)
    const seqCheck = await connection.execute(`SELECT Account_SEQ.NEXTVAL AS SEQ FROM DUAL`);
    const accId = seqCheck.rows[0].SEQ || seqCheck.rows[0].seq;

    if (!accId) {
      throw new Error("ไม่สามารถสร้างรหัสบัญชีใหม่ได้ (Account_SEQ)");
    }

    // 2. Insert Account โดยใช้ AccID ที่ได้มา
    await connection.execute(
      `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, is_active)
       VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
      { accId, accUser, accPass, roomId }
    );

    await connection.execute(
      `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
       VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
      {
        memName,
        memPhone,
        memEmail: memEmail || null,
        accId,
        roomId
      }
    );

    await connection.commit();

    res.json({ success: true, message: 'เพิ่มผู้ใช้และข้อมูลลูกบ้านสำเร็จ' });

  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// UPDATE USER (แก้ไขข้อมูล AccPass และชื่อลูกบ้าน)
// -------------------------------------------------------
exports.updateUser = async (req, res) => {
  const accId = req.params.id;
  const { accPass, memName, memPhone, memEmail } = req.body;

  if (!accPass || !memName || !memPhone) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รหัสผ่าน, ชื่อ, เบอร์โทร)' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    // 1. อัปเดตรหัสผ่าน (Account)
    await connection.execute(
      `UPDATE Account SET AccPass = :accPass WHERE AccID = :accId AND is_active = 1`,
      { accPass, accId }
    );

    // 2. เช็คว่ามีข้อมูลใน Member หรือยัง (เผื่อของเก่าที่ตอนแรกยังไม่มี Member)
    const checkMem = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Member WHERE AccID = :accId`,
      { accId }
    );

    if (checkMem.rows[0].CNT > 0) {
      // มีอยู่แล้ว ให้ UPDATE
      await connection.execute(
        `UPDATE Member 
         SET MemName = :memName, 
             MemPhone = :memPhone, 
             MemEmail = :memEmail 
         WHERE AccID = :accId`,
        { memName, memPhone, memEmail: memEmail || null, accId }
      );
    } else {
      // ถ้ายังไม่มี ต้องดึง RoomID มาก่อนเพื่อ INSERT ใหม่
      const roomCheck = await connection.execute(
        `SELECT RoomID FROM Account WHERE AccID = :accId`,
        { accId }
      );
      if (roomCheck.rows.length > 0) {
        const roomId = roomCheck.rows[0].ROOMID;
        await connection.execute(
          `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
           VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
          { memName, memPhone, memEmail: memEmail || null, accId, roomId }
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'อัปเดตข้อมูลผู้ใช้และข้อมูลลูกบ้านสำเร็จ' });
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// DELETE USER  →  SOFT DELETE (ไม่ลบข้อมูลจริง)
// -------------------------------------------------------
exports.deleteUser = async (req, res) => {
  const id = req.params.id;
  let connection;
  try {
    connection = await db.getConnection();

    // Soft Delete: ปิดใช้งานแทนการลบ
    const result = await connection.execute(
      `UPDATE Account
          SET is_active  = 0,
              deleted_at = SYSDATE
        WHERE AccID = :id
          AND is_active = 1`,
      { id },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้หรือถูก deactivate ไปแล้ว' });
    }

    res.json({ success: true, message: 'ปิดใช้งานผู้ใช้สำเร็จ (ข้อมูลยังถูกเก็บไว้)' });

  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// CHECKOUT USER  (NEW)
// ใช้เมื่อลูกบ้านย้ายออก:
//   1. Deactivate Account
//   2. บันทึก move_out_date
//   3. Reset ห้องเป็น AVAILABLE
// -------------------------------------------------------
exports.checkoutUser = async (req, res) => {
  const { accId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();

    // ดึง RoomID ของ Account นี้ก่อน
    const accResult = await connection.execute(
      `SELECT RoomID FROM Account WHERE AccID = :accId AND is_active = 1`,
      { accId }
    );
    if (accResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Account หรือ deactivate แล้ว' });
    }
    const roomId = accResult.rows[0].ROOMID;

    // 1. Soft Delete + บันทึก move_out_date
    await connection.execute(
      `UPDATE Account
          SET is_active     = 0,
              deleted_at    = SYSDATE,
              move_out_date = SYSDATE
        WHERE AccID = :accId`,
      { accId }
    );

    // 2. Reset ห้องเป็น AVAILABLE
    await connection.execute(
      `UPDATE Room SET RSTATUS = 'AVAILABLE' WHERE ROOMID = :roomId`,
      { roomId }
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Checkout สำเร็จ: Account ถูก deactivate และห้อง ${roomId} เปลี่ยนเป็น AVAILABLE แล้ว`
    });

  } catch (err) {
    console.error('checkoutUser error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// GET USER HISTORY  (NEW)
// ดูประวัติลูกบ้านทั้งหมดของห้อง รวมที่ย้ายออกไปแล้ว
// -------------------------------------------------------
exports.getRoomHistory = async (req, res) => {
  const { roomId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT AccID,
              AccUser,
              RoomID,
              is_active,
              deleted_at    AS deactivated_at,
              move_out_date
         FROM Account
        WHERE RoomID = :roomId
        ORDER BY AccID DESC`,
      { roomId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ success: true, history: result.rows });

  } catch (err) {
    console.error('getRoomHistory error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};
