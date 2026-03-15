const { getConnection } = require('../db');
const bcrypt = require('bcrypt');
const oracledb = require('oracledb');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "กรุณากรอก username และ password"
    });
  }

  let conn;
  try {
    conn = await getConnection();

    // Admin ยังใช้ plain text เหมือนเดิม (ถ้าต้องการ hash admin ด้วยแจ้งได้เลยค่ะ)
    const adminResult = await conn.execute(
      `SELECT ADMINUSER
         FROM ADMIN
        WHERE ADMINUSER = :username
          AND ADMINPASS = :password`,
      { username, password },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (adminResult.rows.length > 0) {
      return res.json({
        success: true,
        role: "admin",
        username: adminResult.rows[0].ADMINUSER
      });
    }

    // แก้ไข: ดึง AccPass มาก่อน แล้วค่อย bcrypt.compare() แทนเปรียบเทียบใน SQL
    const tenantResult = await conn.execute(
      `SELECT AccID, RoomID, AccUser, AccPass
         FROM Account
        WHERE AccUser   = :username
          AND IS_ACTIVE = 1`,
      { username },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tenantResult.rows.length > 0) {
      const user = tenantResult.rows[0];
      const isMatch = await bcrypt.compare(password, user.ACCPASS);

      if (isMatch) {
        return res.json({
          success: true,
          role: "tenant",
          username: user.ACCUSER,
          roomId: user.ROOMID,
          accId: user.ACCID
        });
      }
    }

    // แก้ไข: ตรวจสอบบัญชีที่ถูกปิด โดย bcrypt.compare() เช่นกัน
    const inactiveResult = await conn.execute(
      `SELECT AccPass
         FROM Account
        WHERE AccUser   = :username
          AND IS_ACTIVE = 0`,
      { username },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (inactiveResult.rows.length > 0) {
      const isMatch = await bcrypt.compare(password, inactiveResult.rows[0].ACCPASS);
      if (isMatch) {
        return res.status(401).json({
          success: false,
          message: "บัญชีนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ"
        });
      }
    }

    res.status(401).json({
      success: false,
      message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  } finally {
    if (conn) await conn.close();
  }
};