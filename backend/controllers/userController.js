const db = require('../db');

// -------------------------------------------------------
// GET ALL USERS
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
        WHERE a.IS_ACTIVE = 1
        ORDER BY a.RoomID ASC`
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
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    const check = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE RoomID = :roomId AND IS_ACTIVE = 1`,
      { ":roomId": roomId }
    );
    if (check.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: `ห้อง ${roomId} มีผู้ใช้ที่ใช้งานอยู่แล้ว` });
    }

    const userCheck = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Account WHERE AccUser = :accUser`,
      { ":accUser": accUser }
    );
    if (userCheck.rows[0].CNT > 0) {
      return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    // Insert Account
    const accResult = await connection.execute(
      `INSERT INTO Account (AccUser, AccPass, RoomID, IS_ACTIVE)
       VALUES (:accUser, :accPass, :roomId, 1)`,
      { ":accUser": accUser, ":accPass": accPass, ":roomId": roomId }
    );
    const accId = accResult.lastID;

    // Insert Member
    await connection.execute(
      `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
       VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
      {
        ":memName": memName,
        ":memPhone": memPhone,
        ":memEmail": memEmail || null,
        ":accId": accId,
        ":roomId": roomId
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
// UPDATE USER
// -------------------------------------------------------
exports.updateUser = async (req, res) => {
  const accId = req.params.id;
  const { accPass, memName, memPhone, memEmail } = req.body;

  if (!accPass || !memName || !memPhone) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  let connection;
  try {
    connection = await db.getConnection();

    await connection.execute(
      `UPDATE Account SET AccPass = :accPass WHERE AccID = :accId AND IS_ACTIVE = 1`,
      { ":accPass": accPass, ":accId": accId }
    );

    const checkMem = await connection.execute(
      `SELECT COUNT(*) AS CNT FROM Member WHERE AccID = :accId`,
      { ":accId": accId }
    );

    if (checkMem.rows[0].CNT > 0) {
      await connection.execute(
        `UPDATE Member 
         SET MemName = :memName, 
             MemPhone = :memPhone, 
             MemEmail = :memEmail 
         WHERE AccID = :accId`,
        { ":memName": memName, ":memPhone": memPhone, ":memEmail": memEmail || null, ":accId": accId }
      );
    } else {
      const roomCheck = await connection.execute(
        `SELECT RoomID FROM Account WHERE AccID = :accId`,
        { ":accId": accId }
      );
      if (roomCheck.rows.length > 0) {
        const roomId = roomCheck.rows[0].RoomID;
        await connection.execute(
          `INSERT INTO Member (MemName, MemPhone, MemEmail, AccID, RoomID)
           VALUES (:memName, :memPhone, :memEmail, :accId, :roomId)`,
          { ":memName": memName, ":memPhone": memPhone, ":memEmail": memEmail || null, ":accId": accId, ":roomId": roomId }
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// DELETE USER
// -------------------------------------------------------
exports.deleteUser = async (req, res) => {
  const id = req.params.id;
  let connection;
  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      `UPDATE Account
          SET IS_ACTIVE  = 0,
              DELETED_AT = CURRENT_TIMESTAMP
        WHERE AccID = :id
          AND IS_ACTIVE = 1`,
      { ":id": id }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    }

    await connection.commit();
    res.json({ success: true, message: 'ปิดใช้งานสำเร็จ' });

  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// CHECKOUT USER
// -------------------------------------------------------
exports.checkoutUser = async (req, res) => {
  const { accId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const accResult = await connection.execute(
      `SELECT RoomID FROM Account WHERE AccID = :accId AND IS_ACTIVE = 1`,
      { ":accId": accId }
    );
    if (accResult.rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบ Account' });
    const roomId = accResult.rows[0].RoomID;

    await connection.execute(
      `UPDATE Account
          SET IS_ACTIVE     = 0,
              DELETED_AT    = CURRENT_TIMESTAMP
        WHERE AccID = :accId`,
      { ":accId": accId }
    );

    await connection.execute(`UPDATE Room SET RSTATUS = 'AVAILABLE' WHERE ROOMID = :roomId`, { ":roomId": roomId });
    await connection.commit();
    res.json({ success: true, message: `Checkout ห้อง ${roomId} สำเร็จ` });
  } catch (err) {
    console.error('checkoutUser error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// -------------------------------------------------------
// GET ROOM HISTORY
// -------------------------------------------------------
exports.getRoomHistory = async (req, res) => {
  const { roomId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      `SELECT AccID, AccUser, RoomID, IS_ACTIVE, DELETED_AT
         FROM Account
        WHERE RoomID = :roomId
        ORDER BY AccID DESC`,
      { ":roomId": roomId }
    );
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error('getRoomHistory error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};
