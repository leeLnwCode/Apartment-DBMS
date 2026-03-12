const oracledb = require("oracledb");
require("dotenv").config();


// ตั้งค่า Oracle Client (ถ้าใช้ instant client)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;


// function สำหรับ connect
async function getConnection() {

  return await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING
  });

}


// export function
module.exports = {
  getConnection
};