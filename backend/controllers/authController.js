const { getConnection } = require('../db');

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

    const adminResult = await conn.execute(
      `SELECT ADMINUSER
         FROM ADMIN
        WHERE ADMINUSER = :username
          AND ADMINPASS = :password`,
      { username: username, password: password }
    );

    if (adminResult.rows.length > 0) {
      return res.json({
        success: true,
        role: "admin",
        username: adminResult.rows[0].ADMINUSER
      });
    }

    const tenantResult = await conn.execute(
      `SELECT AccID, RoomID, AccUser
         FROM Account
        WHERE AccUser   = :username
          AND AccPass   = :password
          AND IS_ACTIVE = 1`,
      { username: username, password: password }
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

    const inactiveCheck = await conn.execute(
      `SELECT COUNT(*) AS CNT
         FROM Account
        WHERE AccUser   = :username
          AND AccPass   = :password
          AND IS_ACTIVE = 0`,
      { username: username, password: password }
    );

    if (inactiveCheck.rows[0].CNT > 0) {
      return res.status(401).json({
        success: false,
        message: "บัญชีนี้ถูกปิดใช้งานแล้ว กรุณาติดต่อผู้ดูแลระบบ"
      });
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
