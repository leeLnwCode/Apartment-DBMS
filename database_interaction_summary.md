# รายงานสรุปการจัดการฐานข้อมูล (Oracle Database Interaction Summary)

เอกสารนี้สรุปแนวทางการออกแบบและการเชื่อมต่อฐานข้อมูล Oracle ในโปรเจกต์ Apartment DBMS เพื่อใช้เป็นข้อมูลประกอบการอธิบายให้กับอาจารย์

---

## 1. โครงสร้างและการไหลของข้อมูล (Data Flow)

ระบบมีการออกแบบให้ตารางทำงานสัมพันธ์กันอย่างเป็นลำดับขั้นตอน (Transaction Workflow):
1.  **Booking Phase**: เมื่อผู้ใช้จองห้องพัก ข้อมูลจะถูกบันทึกลงตาราง `Booker` (ผู้จอง) และ [Booking](file:///e:/DBMS_Project/Apartment-DBMS/js/booking.js#55-119) (รายการจอง) พร้อมทั้ง [Payment](file:///e:/DBMS_Project/Apartment-DBMS/js/member-dashboard.js#76-94) (สลิปมัดจำ)
2.  **Approval Phase**: เมื่อแอดมินอนุมัติ ระบบจะทำรายการแบบ **Atomic Transaction** (สำเร็จทั้งหมดหรือล้มเหลวทั้งหมด):
    *   สร้าง `Account` (บัญชีผู้ใช้) โดยดึงเบอร์โทรจาก `Booker` มาเป็นรหัสผ่าน
    *   สร้าง `Member` (ลูกบ้าน) อัตโนมัติ โดยดึงข้อมูลจาก `Booker` มาบันทึกและผูกกับ `Account`
    *   อัปเดตสถานะห้องในตาราง [Room](file:///e:/DBMS_Project/Apartment-DBMS/backend/controllers/roomController.js#31-67) เป็น 'OCCUPIED'

---

## 2. เทคนิคพิเศษที่ใช้กับ Oracle Database

### 2.1 การจัดการ Sequence และ Primary Key
ระบบใช้ **Sequences** (เช่น `Account_SEQ`, `Booking_SEQ`) ในการรันหมายเลข ID โดยมีเทคนิคที่สำคัญคือ:
*   **Selective Fetching via DUAL**: ก่อนการ Insert ข้อมูลที่ต้องใช้ ID ร่วมกัน (เช่น Account และ Member) ระบบจะใช้คำสั่ง:
    ```sql
    SELECT Account_SEQ.NEXTVAL AS SEQ FROM DUAL
    ```
    เพื่อให้ได้ค่า ID ที่แน่นอนออกมาก่อน แล้วจึงนำค่านั้นไปใช้ Insert ลงทั้งสองตาราง เพื่อป้องกันปัญหา ID ไม่ตรงกันหรือเป็นค่าว่าง (Null pointer)

### 2.2 การควบคุม Transaction (ACID Properties)
เพื่อให้ข้อมูลมีความถูกต้องสูงสุด ระบบใช้:
*   `conn.commit()`: ยืนยันการบันทึกข้อมูลเมื่อทุกคำสั่งในชุดนั้นทำงานสำเร็จ
*   `conn.rollback()`: ยกเลิกการเปลี่ยนแปลงทั้งหมดหากมีคำสั่งใดคำสั่งหนึ่งผิดพลาด (Error handling) เพื่อป้องกันเนื้อข้อมูลที่ "ครึ่งๆ กลางๆ" (เช่น มี Account แต่ไม่มี Member)

### 2.3 การดึงข้อมูลแบบ Object Format
เพื่อให้โค้ด JavaScript อ่านง่ายและจัดการข้อมูลได้แม่นยำ ระบบมีการตั้งค่า:
```javascript
{ outFormat: oracledb.OUT_FORMAT_OBJECT }
```
ทำให้ผลลัพธ์จาก SQL กลายเป็น Object ที่เข้าถึงด้วยชื่อคอลัมน์ได้ทันที (เช่น `row.ROOMID`) แทนที่จะเป็น Array ตัวเลข

---

## 3. สรุปการทำงานของส่วนประกอบหลัก (Controller Logic)

| ส่วนประกอบ (Controller) | ภารกิจหลักในฐานข้อมูล | คำสั่ง SQL สำคัญ |
| :--- | :--- | :--- |
| **Booking** | จัดการจองและอนุมัติ (สร้างลูกบ้านอัตโนมัติ) | `INSERT` (Booker, Booking), `UPDATE` (Status) |
| **User** | จัดการบัญชีผู้ใช้และข้อมูลส่วนตัวลูกบ้าน | `LEFT JOIN` (Account + Member) |
| **Bill** | คำนวณค่าน้ำค่าไฟและกำหนดวันครบกำหนด | `ADD_MONTHS`, `TO_DATE` (คำนวณ DueDate) |
| **Payment** | บันทึกประวัติการจ่ายเงินและไฟล์สลิป | `INSERT` (Payment) |
| **Room** | ตรวจสอบและเปลี่ยนสถานะห้องพัก | `UPDATE` (RSTATUS) |

---

## 4. ข้อดีของแนวทางนี้ (Key Takeaways)
1.  **Data Integrity**: ข้อมูลของลูกบ้านจะถูกสร้างขึ้นทันทีที่อนุมัติการจอง ไม่มีการตกหล่น
2.  **Security**: ใช้ **Bind Variables** (`:id`, `:name`) เพื่อป้องกันการโจมตีแบบ SQL Injection
3.  **Automation**: ลดภาระของแอดมินด้วยการดึงข้อมูลจากใบจองมาสร้างบัญชีผู้ใช้ให้อัตโนมัติด้วยรูปแบบที่กำหนดไว้ (`room` + [เลขห้อง])
