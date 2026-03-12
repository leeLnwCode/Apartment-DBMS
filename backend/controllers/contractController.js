const { getConnection } = require('../db');
const path = require("path");
const fs = require("fs");

exports.getAllContracts = async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT CONTRACID, CONTRACTFILE, ROOMID, UPLOADDATE
       FROM CONTRACT
       ORDER BY CONTRACID DESC`
    );

    res.json({
      success: true,
      contracts: result.rows
    });

  } catch (err) {
    console.error("GET CONTRACT ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.createContract = async (req, res) => {
  let connection;
  try {
    const roomId = req.body.roomId;
    const fileName = req.file.filename;

    connection = await getConnection();

    const sql = `
      INSERT INTO CONTRACT
      (CONTRACTFILE, ROOMID, UPLOADDATE)
      VALUES
      (:contractFile, :roomId, CURRENT_TIMESTAMP)
    `;

    const binds = {
      contractFile: fileName,
      roomId: roomId
    };

    await connection.execute(sql, binds);
    res.json({ success: true });

  } catch (err) {
    console.error("CREATE CONTRACT ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.downloadContract = async (req, res) => {
  const fileName = req.params.file;
  const filePath = path.join(__dirname, "../uploads", fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "ไม่พบไฟล์" });
  }

  res.sendFile(filePath);
};
