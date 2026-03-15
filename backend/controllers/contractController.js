const { getConnection } = require('../db');
const path = require("path");
const fs = require("fs");

// แก้ไข: เพิ่ม JOIN กับ MEMBER และแก้ชื่อ column (CONTRACID -> CONTRACTID, UPLOADDATE -> CREATED_AT)
exports.getAllContracts = async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT c.CONTRACTID,
              c.CONTRACTFILE,
              c.ROOMID,
              c.MEMID,
              m.MEMNAME,
              m.MEMPHONE,
              c.CONTRACT_START_DATE,
              c.CONTRACT_END_DATE,
              c.RENT_PRICE,
              c.DEPOSIT_AMOUNT,
              c.WATER_PRICE_PER_UNIT,
              c.ELECTRIC_PRICE_PER_UNIT,
              c.STATUS,
              c.CREATED_AT
         FROM CONTRACT c
         LEFT JOIN MEMBER m ON c.MEMID = m.MEMID
        ORDER BY c.CONTRACTID DESC`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
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

// แก้ไข: เพิ่ม validation, commit, MEMID, STATUS, ราคา และ field ครบตามตาราง
exports.createContract = async (req, res) => {
  let connection;
  try {
    const {
      roomId,
      memId,
      contractStartDate,
      contractEndDate,
      rentPrice,
      depositAmount,
      waterPricePerUnit,
      electricPricePerUnit
    } = req.body;

    // validation
    if (!roomId || !memId || !contractStartDate || !contractEndDate || !rentPrice) {
      return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    // แก้ไข: ตรวจสอบว่า req.file มีอยู่จริงก่อนใช้
    const fileName = req.file ? req.file.filename : null;

    connection = await getConnection();

    // ดึง CONTRACTID จาก sequence
    const seqResult = await connection.execute(
      `SELECT SEQ_CONTRACTID.NEXTVAL AS SEQ FROM DUAL`,
      [],
      { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
    );
    const contractId = seqResult.rows[0].SEQ;

    const sql = `
      INSERT INTO CONTRACT (
        CONTRACTID,
        CONTRACTFILE,
        ROOMID,
        MEMID,
        CONTRACT_START_DATE,
        CONTRACT_END_DATE,
        RENT_PRICE,
        DEPOSIT_AMOUNT,
        WATER_PRICE_PER_UNIT,
        ELECTRIC_PRICE_PER_UNIT,
        STATUS,
        CREATED_AT
      ) VALUES (
        :contractId,
        :contractFile,
        :roomId,
        :memId,
        TO_DATE(:contractStartDate, 'YYYY-MM-DD'),
        TO_DATE(:contractEndDate,   'YYYY-MM-DD'),
        :rentPrice,
        :depositAmount,
        :waterPricePerUnit,
        :electricPricePerUnit,
        'active',
        SYSDATE
      )
    `;

    const binds = {
      contractId,
      contractFile:         fileName,
      roomId,
      memId,
      contractStartDate,
      contractEndDate,
      rentPrice:            parseFloat(rentPrice),
      depositAmount:        parseFloat(depositAmount)        || 0,
      waterPricePerUnit:    parseFloat(waterPricePerUnit)    || 0,
      electricPricePerUnit: parseFloat(electricPricePerUnit) || 0
    };

    await connection.execute(sql, binds);

    // แก้ไข: อัปเดตวันเข้าจริงใน MEMBER ด้วย (ถ้ายังไม่มี)
    await connection.execute(
      `UPDATE MEMBER
          SET ACTUAL_CHECKIN_DATE = TO_DATE(:startDate, 'YYYY-MM-DD')
        WHERE MEMID = :memId
          AND ACTUAL_CHECKIN_DATE IS NULL`,
      { startDate: contractStartDate, memId: memId }
    );

    // แก้ไข: เพิ่ม commit
    await connection.commit();

    res.json({ success: true, message: 'สร้างสัญญาสำเร็จ', contractId });

  } catch (err) {
    console.error("CREATE CONTRACT ERROR:", err);
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// แก้ไข: ป้องกัน path traversal
exports.downloadContract = async (req, res) => {
  const rawName = req.params.file;

  // แก้ไข: ป้องกัน path traversal เช่น ../../etc/passwd
  const safeName = path.basename(rawName);
  if (safeName !== rawName) {
    return res.status(400).json({ success: false, message: 'ชื่อไฟล์ไม่ถูกต้อง' });
  }

  const filePath = path.join(__dirname, "../uploads", safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'ไม่พบไฟล์' });
  }

  res.sendFile(filePath);
};