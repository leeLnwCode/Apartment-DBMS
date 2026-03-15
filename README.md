# Apartment Management System (DBMS)

A web-based system designed to manage apartment operations including room bookings, tenant management, rental contracts, monthly utility bills, and payment verification.

---

## Project Overview

The **Apartment Management System** is a database-driven web application that helps apartment owners manage rooms, tenants, contracts, and monthly bills efficiently.

The system allows potential residents to view available rooms and submit booking requests online — including uploading a payment deposit slip — without requiring a login. After admin approval, residents automatically receive login credentials to access their personal dashboard, where they can view monthly utility bills, payment records, and rental contract details.

This project was developed as part of a **Database Management Systems (DBMS)** course, with a focus on backend architecture, RESTful API development, relational database design, and transaction management.

---

## Tech Stack

**Frontend**
- HTML, CSS, JavaScript (Vanilla JS)
- Tailwind CSS

**Backend**
- Node.js
- Express.js
- bcrypt (password hashing)

**Database**
- Oracle Database
- node-oracledb

**Middleware**
- Multer (file upload handling)

---

## Key Features

### Room Booking System
Users can browse available rooms and submit booking requests online, including uploading a deposit payment slip for verification.

### Admin Dashboard
Admins can review and approve booking requests, manage room availability, create utility bills, verify payments, and manage rental contracts — all from a single dashboard.

### Member Account System
When a booking is approved, the system automatically:
- Creates an `Account` with a hashed password (bcrypt)
- Creates a `Member` record linked to the account
- Records the actual check-in date from the contract start date
- Updates the room status to `OCCUPIED`

### Utility Bill Management
The system calculates monthly water and electricity bills per room based on meter readings, storing unit usage, cost per unit, and total amount.

### Payment Verification
Residents can upload payment slips. Admins can review and verify payments directly from the dashboard.

### Rental Contract Management
Admins can create and upload rental contracts with full details including contract period, rent price, deposit amount, and water/electricity rates per unit. Contracts are linked to both the room and the member.

### Tenant Checkout
When a tenant moves out, the system records the actual checkout date, checkout reason, and notes — and automatically updates the contract status to `expired` and releases the room back to `AVAILABLE`.

---

## Database Schema

The system uses **9 tables** with the following relationships:

| Table | Description |
|---|---|
| `ROOM` | All apartment rooms with pricing and availability status |
| `ACCOUNT` | User login accounts (username / hashed password) |
| `MEMBER` | Tenant information including actual check-in/out dates and checkout reason |
| `CONTRACT` | Rental contracts with start/end dates, rent price, deposit, and water/electricity rates |
| `BILL` | Monthly utility bills calculated from water and electricity meter readings |
| `PAYMENT` | Payment history with uploaded slip files |
| `BOOKING` | Room booking requests submitted by prospective tenants |
| `BOOKER` | Personal details of the person who submitted a booking request |
| `ADMIN` | Administrator accounts for system management |

**Key relationships:**
- `ROOM` → `ACCOUNT` → `MEMBER` (one room, one active tenant at a time)
- `MEMBER` → `CONTRACT` (one member can have multiple contracts over time)
- `BOOKER` → `BOOKING` → `PAYMENT` (booking flow with payment slip upload)
- `ROOM` → `BILL` and `ROOM` → `PAYMENT` (all billing tied to room)

---

## Technical Concepts Applied

### Transaction Management
Every multi-table operation uses explicit `commit()` and `rollback()` to guarantee data consistency. Key transactions include:

| Transaction | Tables Involved |
|---|---|
| Create booking | Booker → Booking → Payment |
| Approve booking | Account → Member → Booking → Room → Payment |
| Tenant checkout | Account → Member → Contract → Room |
| Create contract | Contract → Member (auto-fill check-in date) |
| Create user | Account → Member |

### Password Security
All passwords are hashed using **bcrypt** before storage. Login uses `bcrypt.compare()` — passwords are never compared in plain text or inside SQL queries.

### Database Constraints & Integrity
- `PRIMARY KEY` and `FOREIGN KEY` constraints on all tables
- `CHECK` constraints on `CONTRACT.STATUS` (active / expired / cancelled / pending) and all price fields (`>= 0`)
- `NOT NULL` enforcement on required fields
- `DEFAULT` values: `STATUS = 'pending'`, `CREATED_AT = SYSDATE`

### Triggers
- `TRG_CONTRACT_UPDATED_AT` — automatically sets `UPDATED_AT` on every contract update
- `TRG_MEMBER_CHECKIN_DATE` — auto-fills `ACTUAL_CHECKIN_DATE` from contract start date
- `TRG_MEMBER_CHECKOUT_VALIDATE` — enforces that `CHECKOUT_REASON` is required when `ACTUAL_CHECKOUT_DATE` is set

### Oracle Sequences
Auto-increment IDs using Oracle Sequences: `ACCOUNT_SEQ`, `MEMBER_SEQ`, `BOOKING_SEQ`, `BOOKER_SEQ`, `PAYMENT_SEQ`, `SEQ_CONTRACTID`

### Other Practices
- `OUT_FORMAT_OBJECT` on all queries for consistent column name access
- `path.basename()` validation on file downloads to prevent path traversal attacks
- Soft delete using `IS_ACTIVE = 0` and `DELETED_AT` timestamp
- SQL JOIN queries across Account, Member, Room, Contract, Booking, and Payment tables
- Bind variables throughout to prevent SQL injection

---

## My Role in the Project

This project was developed as a **team project**.

**My Responsibilities:** Backend Development and Database Design & Management

### Backend Development
- Developed RESTful APIs using Node.js and Express.js for all major modules: rooms, bookings, members, contracts, bills, and payments
- Implemented the full booking approval flow — auto-creating Account and Member with hashed credentials
- Built the tenant checkout flow — recording actual checkout date, reason, and releasing the room
- Developed the rental contract API with full field support (dates, pricing, file upload)
- Implemented file upload for payment slips and contract files using Multer
- Added bcrypt password hashing across all user creation and login flows
- Fixed `ORA-01400` errors caused by missing sequence-generated IDs before INSERT
- Implemented server-side validation, structured error responses, and rollback on failure

### Database Design & Management
- Designed the relational database schema with 9 tables
- Added `ACTUAL_CHECKIN_DATE`, `ACTUAL_CHECKOUT_DATE`, `CHECKOUT_REASON`, and `CHECKOUT_NOTE` columns to `MEMBER`
- Added 9 new columns to `CONTRACT` via `ALTER TABLE` (contract dates, rent price, deposit, water/electric rates, status, updated_at, deleted_at)
- Implemented `PRIMARY KEY`, `FOREIGN KEY`, `CHECK`, `NOT NULL`, and `DEFAULT` constraints
- Created 3 Triggers for automatic date management and validation
- Created Indexes on frequently queried columns for performance
- Used Oracle Sequences for all auto-increment IDs

---

## Learning Outcomes

Through this project, I gained hands-on experience in:
- Designing and managing a relational Oracle database schema with constraints and triggers
- Building and debugging RESTful backend APIs with Node.js and Express
- Implementing multi-table transactions with commit and rollback
- Applying password security best practices using bcrypt
- Handling file uploads and safe file serving in web applications
- Structuring backend code using a controller-based architecture
- Debugging Oracle-specific errors (ORA-01400, column name mismatches, OUT_FORMAT_OBJECT)
- Connecting frontend interfaces to live database APIs

---

## Future Improvements
- Implement JWT authentication and session management
- Add real-time notifications for bill and payment updates
- Improve mobile responsiveness
- Add admin dashboard analytics (revenue charts, occupancy rate)
- Implement tenant–admin messaging system
- Add line notification for bill reminders