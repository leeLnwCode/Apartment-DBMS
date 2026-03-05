const oracledb = require('oracledb');
const db = require('../db');

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
    conn = await db.getConnection();

    // 🔹 ตรวจสอบ ADMIN ก่อน
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

    // 🔹 ตรวจสอบ Tenant
    const tenantResult = await conn.execute(
      `SELECT AccID, RoomID, AccUser
       FROM Account
       WHERE AccUser = :username
       AND AccPass = :password`,
      { username, password },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (tenantResult.rows.length > 0) {
      const user = tenantResult.rows[0];

      return res.json({
        success: true,
        role: "tenant",
        username: user.ACCUSER,
        roomId: user.ROOMID,
        accId: user.ACCID
      });
    }

    res.status(401).json({
      success: false,
      message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในระบบ"
    });
  } finally {
    if (conn) await conn.close();
  }
};