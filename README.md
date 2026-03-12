# Apartment Management System (DBMS)

A web-based system designed to manage apartment operations including room bookings, tenant management, monthly utility bills, and payment verification.

---

## Project Overview

The **Apartment Management System** is a database-driven web application that helps apartment owners manage rooms, tenants, and monthly bills efficiently.

The system allows potential residents to view available rooms and request bookings without logging in. After approval, residents receive login credentials to access their personal dashboard and view monthly utility bills and payment records.

This project was developed as part of a **Database Management Systems (DBMS)** course and focuses on backend architecture, RESTful API development, and relational database design.

---

## Tech Stack

**Frontend**
- HTML
- CSS
- JavaScript (Vanilla JS)

**Backend**
- Node.js
- Express.js

**Database**
- Oracle Database
- node-oracledb

**Middleware**
- Multer (file upload handling)

---

## Key Features

### Room Booking System
Users can browse available rooms and submit booking requests online.

### Admin Management
Admins can review booking requests, approve tenants, and manage room availability.

### Member Account System
When a booking is approved, the system automatically generates a resident account with login credentials.

### Utility Bill Management
The system calculates **monthly water and electricity bills** for each room and stores them in the database.

### Payment Verification
Residents can upload **payment slips**, and admins can review and verify payments.

### Contract Management
Digital rental contracts can be uploaded and downloaded by the system.

---

## Technical Concepts Applied

This project demonstrates several backend and database development practices:

- **RESTful API Architecture** using Node.js and Express
- **Transaction Management** using `commit()` and `rollback()` to maintain data consistency
- **Oracle Sequence Integration** for automatic ID generation
- **SQL JOIN Queries** to combine data across multiple tables (Account, Member, Room, Bill)
- **Soft Delete Strategy** using an `IS_ACTIVE` flag to maintain historical records
- **File Upload Handling** for payment slips and rental contracts
- **Backend Error Handling** with structured responses and validation

---

## My Role in the Project

This project was developed as a **team project**.

**My Responsibilities**
- Backend Development
- Database Design and Management

### Backend Development
- Developed **RESTful APIs** using Node.js and Express.js
- Implemented booking request handling and tenant approval logic
- Built the billing system for calculating water and electricity usage
- Implemented file upload functionality for payment slips using **multer**
- Implemented server-side validation and error handling

### Database Design & Management
- Designed the **relational database schema**
- Implemented tables, relationships, and constraints
- Used **Oracle Sequences** for automatic ID generation
- Implemented **transactions (Commit / Rollback)** to ensure data integrity
- Used **Bind Variables** to prevent SQL Injection

---
## Learning Outcomes

Through this project, I gained experience in:

- Designing relational database schemas using **Oracle Database**
- Building RESTful backend APIs using **Node.js and Express**
- Managing database transactions and sequences
- Handling file uploads in web applications
- Structuring backend code using controller-based architecture
- Integrating backend APIs with frontend interfaces

---

## Future Improvements

- Implement **JWT authentication**
- Add **real-time notifications**
- Improve **mobile responsiveness**
- Add dashboard analytics (revenue charts, occupancy rate)
- Implement tenant–admin messaging

---
