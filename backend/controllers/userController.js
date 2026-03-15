const { getConnection } = require('../db');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

exports.getAllUsers = async (req, res) => {
  let connection;
  try {
    connection = await getConnection();

    const result = await connection.execute(
      `SELECT a.AccID,
              a.AccUser,
              a.RoomID,
              m.MEMID,
              m.MemName,
              m.MemPhone,
              m.MemEmail,
              m.ACTUAL_CHECKIN_DATE,
              m.ACTUAL_CHECKOUT_DATE,
              m.CHECKOUT_REASON
         FROM Account a
         LEFT JOIN Member m ON a.AccID = m.AccID
        WHERE a.IS_ACTIVE = 1
        ORDER BY a.RoomID ASC`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );

    res.json({ success: true, users: result.rows });

  } catch (err) {
    console.error('getAllUsers error:', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงรายการผู้ใช้ได้' });
  } finally {
    if (connection) await connection.close();
  }
};

exports.createUser = async (req, res) => {
  const { roomId, accUser, accPass, memName, memPhone, memEmail } = req.body;

  if (!roomId || !accUser || !accPass || !memName || !memPhone) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  let connection;
  try {
    connection = await getConnection();

    const check = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE RoomID = :roomId AND IS_ACTIVE = 1`,
      { roomId },
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    if (check.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: `ห้อง ${roomId} มีผู้ใช้ที่ใช้งานอยู่แล้ว` });
    }

    const userCheck = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE AccUser = :accUser`,
      { accUser },
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    if (userCheck.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    // แก้ไข: hash รหัสผ่านก่อนเก็บ
    const hashedPass = await bcrypt.hash(accPass, SALT_ROUNDS);

    const accSeq = await connection.execute(
      `SELECT ACCOUNT_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    const accId = accSeq.rows[0].SEQ;

    await connection.execute(
      `INSERT INTO Account (AccID, AccUser, AccPass, RoomID, IS_ACTIVE)
       VALUES (:accId, :accUser, :accPass, :roomId, 1)`,
      { accId, accUser, accPass: hashedPass, roomId }
    );

    const memSeq = await connection.execute(
      `SELECT MEMBER_SEQ.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    const memId = memSeq.rows[0].SEQ;

    // แก้ไข: ชื่อ column MEMID (ไม่ใช่ MemberID)
    await connection.execute(
      `INSERT INTO Member (MEMID, MemName, MemPhone, MemEmail, AccID, RoomID)
       VALUES (:memId, :memName, :memPhone, :memEmail, :accId, :roomId)`,
      {
        memId,
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
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.updateUser = async (req, res) => {
  const accId = req.params.id;
  const { accPass, memName, memPhone, memEmail } = req.body;

  if (!memName || !memPhone) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  let connection;
  try {
    connection = await getConnection();

    // แก้ไข: hash รหัสผ่านใหม่ก่อน update (ถ้ามีการส่ง accPass มา)
    if (accPass) {
      const hashedPass = await bcrypt.hash(accPass, SALT_ROUNDS);
      await connection.execute(
        `UPDATE Account SET AccPass = :accPass WHERE AccID = :accId AND IS_ACTIVE = 1`,
        { accPass: hashedPass, accId }
      );
    }

    const checkMem = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Member WHERE AccID = :accId`,
      { accId },
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );

    if (checkMem.rows[0].CNT > 0) {
      await connection.execute(
        `UPDATE Member
            SET MemName  = :memName,
                MemPhone = :memPhone,
                MemEmail = :memEmail
          WHERE AccID = :accId`,
        { memName, memPhone, memEmail: memEmail || null, accId }
      );
    } else {
      const roomCheck = await connection.execute(
        `SELECT RoomID FROM Account WHERE AccID = :accId`,
        { accId },
        { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
      );
      if (roomCheck.rows.length > 0) {
        const roomId = roomCheck.rows[0].ROOMID;
        const memSeq = await connection.execute(
          `SELECT MEMBER_SEQ.NEXTVAL AS SEQ FROM DUAL`,
          [],
          { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );
        const memId = memSeq.rows[0].SEQ;

        // แก้ไข: ชื่อ column MEMID
        await connection.execute(
          `INSERT INTO Member (MEMID, MemName, MemPhone, MemEmail, AccID, RoomID)
           VALUES (:memId, :memName, :memPhone, :memEmail, :accId, :roomId)`,
          { memId, memName, memPhone, memEmail: memEmail || null, accId, roomId }
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    console.error('updateUser error:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// แก้ไข: deleteUser = ลบบัญชีแบบ soft delete เท่านั้น (ไม่ checkout)
exports.deleteUser = async (req, res) => {
  const id = req.params.id;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `UPDATE Account
          SET IS_ACTIVE  = 0,
              DELETED_AT = SYSDATE
        WHERE AccID = :id
          AND IS_ACTIVE = 1`,
      { id }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    }

    await connection.commit();
    res.json({ success: true, message: 'ปิดใช้งานสำเร็จ' });

  } catch (err) {
    console.error('deleteUser error:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// แก้ไข: checkoutUser บันทึกวันออกจริงและเหตุผลใน MEMBER ด้วย
exports.checkoutUser = async (req, res) => {
  const { accId } = req.params;
  // แก้ไข: รับ checkoutReason และ checkoutNote จาก body
  const { checkoutReason, checkoutNote } = req.body;

  if (!checkoutReason) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลการออก' });
  }

  let connection;
  try {
    connection = await getConnection();

    const accResult = await connection.execute(
      `SELECT RoomID FROM Account WHERE AccID = :accId AND IS_ACTIVE = 1`,
      { accId },
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    if (accResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบ Account' });
    }
    const roomId = accResult.rows[0].ROOMID;

    // ปิด Account
    await connection.execute(
      `UPDATE Account
          SET IS_ACTIVE  = 0,
              DELETED_AT = SYSDATE
        WHERE AccID = :accId`,
      { accId }
    );

    // แก้ไข: บันทึกวันออกจริง + เหตุผลใน MEMBER
    await connection.execute(
      `UPDATE Member
          SET ACTUAL_CHECKOUT_DATE = SYSDATE,
              CHECKOUT_REASON      = :checkoutReason,
              CHECKOUT_NOTE        = :checkoutNote
        WHERE AccID = :accId`,
      {
        checkoutReason,
        checkoutNote: checkoutNote || null,
        accId
      }
    );

    // อัปเดตสถานะสัญญาเป็น expired
    await connection.execute(
      `UPDATE Contract
          SET STATUS     = 'expired',
              UPDATED_AT = SYSDATE
        WHERE ROOMID = :roomId
          AND STATUS = 'active'`,
      { roomId }
    );

    // คืนสถานะห้อง
    await connection.execute(
      `UPDATE Room SET RSTATUS = 'AVAILABLE' WHERE ROOMID = :roomId`,
      { roomId }
    );

    await connection.commit();
    res.json({ success: true, message: `Checkout ห้อง ${roomId} สำเร็จ` });

  } catch (err) {
    console.error('checkoutUser error:', err);
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.getRoomHistory = async (req, res) => {
  const { roomId } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT a.AccID,
              a.AccUser,
              a.RoomID,
              a.IS_ACTIVE,
              a.DELETED_AT,
              m.MemName,
              m.ACTUAL_CHECKIN_DATE,
              m.ACTUAL_CHECKOUT_DATE,
              m.CHECKOUT_REASON,
              m.CHECKOUT_NOTE
         FROM Account a
         LEFT JOIN Member m ON a.AccID = m.AccID
        WHERE a.RoomID = :roomId
        ORDER BY a.AccID DESC`,
      { roomId },
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('getRoomHistory error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};