const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'apartment.db');
const schemaPath = path.join(__dirname, 'database', 'schema.sqlite.sql');

// ตรวจสอบโฟลเดอร์ database
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

// Wrapper สำหรับใช้ async/await และเลียนแบบ oracledb
const execute = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    // แปลง :name เป็น $name สำหรับ SQLite if needed, แต่ SQLite รองรับ :name ด้วย!
    // อย่างไรก็ตาม SQLite ใช้งาน ? หรือ $name หรือ :name ได้
    
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    
    if (isSelect) {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows });
      });
    } else {
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ rowsAffected: this.changes, lastID: this.lastID });
      });
    }
  });
};

// ฟังก์ชันจำลอง getConnection เพื่อให้โค้ดเก่าทำงานได้ง่ายขึ้น
const getConnection = async () => {
  return {
    execute: (sql, params, options) => execute(sql, params),
    commit: async () => {}, // SQLite auto-commits or handled elsewhere
    rollback: async () => {},
    close: async () => {} 
  };
};

// Initialize schema if db is new
const initDb = () => {
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) console.error('Error initializing schema:', err);
      else console.log('SQLite database initialized.');
    });
  }
};

initDb();

module.exports = {
  getConnection,
  execute,
  db
};