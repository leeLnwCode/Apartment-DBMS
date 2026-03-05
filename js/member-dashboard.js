
// --------------------------------------------------
// Constants & Global Variables
// --------------------------------------------------
const API_BASE = "http://localhost:3000/api";

let activePage = "dashboard";
let bills = [];
let payments = [];

let uploadedSlip = null;
let uploadedFile = null;

let paymentMethod = "account";

// --------------------------------------------------
// DOM Ready & Initialization
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  const roomId = localStorage.getItem("tenantRoomId");
  const username = localStorage.getItem("tenantUsername");
  const accId = localStorage.getItem("tenantAccId");

  if (!roomId || !username) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    window.location.href = "auth.html";
    return;
  }

  // แสดงข้อมูลผู้ใช้
  document.getElementById("memberUsername").textContent = username;
  document.getElementById("desktopRoomNumber").textContent = `ห้อง ${roomId}`;
  document.getElementById("mobileRoomNumber").textContent = `ห้อง ${roomId}`;

  await loadBills();
  await loadPayments();

  render();

  initEventListeners();
});

// --------------------------------------------------
// Data Loading
// --------------------------------------------------
async function loadBills() {
  const roomId = localStorage.getItem("tenantRoomId");

  try {
    const res = await fetch(`${API_BASE}/bills/room/${roomId}`);
    const data = await res.json();

    if (data.success) {

      bills = data.data.map(b => ({
        billId: b.billId,
        roomId: b.roomId,
        totalAmount: b.totalAmount,
        status: b.status,
        waterUnit: b.waterUnit,
        electricUnit: b.electricUnit,
        waterCost: b.waterCost,
        electricCost: b.electricCost,
        BILLMONTH: b.BILLMONTH,
        BILLYEAR: b.BILLYEAR,
      }));

    }

  } catch (err) {
    console.error("loadBills error", err);
    bills = [];
  }
}

async function loadPayments() {
  const accId = localStorage.getItem("tenantAccId");

  try {
    const res = await fetch(`${API_BASE}/payments/member/${accId}`);
    const data = await res.json();

    if (data.success) {
      payments = data.data;
    } else {
      console.warn("loadPayments ไม่สำเร็จ:", data.message);
      payments = [];
    }
  } catch (err) {
    console.error("loadPayments error", err);
    payments = [];
  }
}

// --------------------------------------------------
// Utility Functions
// --------------------------------------------------
function getCurrentBill() {
  return bills.find(
    b => (b.status || b.STATUS || "").toUpperCase() === "UNPAID"
  );
}

// --------------------------------------------------
// Rendering
// --------------------------------------------------
function render() {
  const main = document.getElementById("mainContent");
  if (!main) return;

  let content = "";

  switch (activePage) {
    case "dashboard":
      content = renderDashboard();
      break;
    case "payment":
      content = renderPayment();
      break;
    case "history":
      content = renderHistory();
      break;
  }

  main.innerHTML = content;

  // Re-attach file input listener after render
  attachFileInputListener();
}

function renderDashboard() {
  const bill = getCurrentBill();

  let html = `<h2 class="text-3xl font-bold mb-6">ภาพรวมแดชบอร์ด</h2>`;

  if (!bill) {
    html += `
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 sm:p-16 text-center">
        <div class="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-gray-800 mb-3">ไม่มียอดค้างชำระ</h3>
        <p class="text-gray-500">คุณได้ชำระค่าใช้จ่ายทั้งหมดเรียบร้อยแล้ว</p>
      </div>
    `;
    return html;
  }

  const total = Number(bill.totalAmount) || 0;
  const waterCost = bill.waterUnit * bill.waterCost;
  const elecCost = bill.electricUnit * bill.electricCost;
  const roomRent = total - (waterCost || 0) - (elecCost || 0);

  // คำนวณวันครบกำหนด
  const monthMap = {
    "มกราคม": 0, "กุมภาพันธ์": 1, "มีนาคม": 2, "เมษายน": 3,
    "พฤษภาคม": 4, "มิถุนายน": 5, "กรกฎาคม": 6, "สิงหาคม": 7,
    "กันยายน": 8, "ตุลาคม": 9, "พฤศจิกายน": 10, "ธันวาคม": 11
  };

  const m = parseInt(bill.BILLMONTH) - 1;
const y = parseInt(bill.BILLYEAR);

const dueDate = new Date(y, m + 1, 5);
const monthName = new Date(y, m).toLocaleString("th-TH", { month: "long" });
  const dueDateText = `5 ${dueDate.toLocaleString('th-TH', { month: 'long' })} ${dueDate.getFullYear()}`;

  html += `
    <div class="bg-gradient-to-br from-green-600 via-green-700 to-green-900 rounded-2xl p-8 text-white shadow-xl mb-8">
      <h3 class="text-2xl font-bold mb-2">ยอดชำระเดือนปัจจุบัน</h3>
      <div class="text-green-100 mb-6 flex justify-between">
        <span>${monthName} ${bill.BILLYEAR}</span>
        <span class="bg-white/20 border border-white/30 px-4 py-2 rounded-lg text-sm font-semibold">
          ครบกำหนดชำระ : ${dueDateText}
        </span>
      </div>

      <div class="space-y-3 bg-black/20 rounded-xl p-6">
        <div class="flex justify-between"><span>ค่าห้องพัก</span><span>฿${roomRent.toLocaleString()}</span></div>
        <div class="flex justify-between"><span>จำนวนหน่วยน้ำ (หน่วยละ 25 บาท)</span><span>${bill.waterUnit}</span></div>
        <div class="flex justify-between"><span>จำนวนหน่วยไฟ (หน่วยละ 7 บาท)</span><span>${bill.electricUnit}</span></div>
        <div class="flex justify-between"><span>ค่าน้ำประปา</span><span>฿${waterCost.toLocaleString()}</span></div>
        <div class="flex justify-between"><span>ค่าไฟฟ้า</span><span>฿${elecCost.toLocaleString()}</span></div>
        <div class="flex justify-between text-2xl font-bold border-t border-white/20 pt-4">
          <span>ยอดรวมชำระทั้งสิ้น</span>
          <span>฿${total.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <button onclick="goTo('payment')"
      class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 px-10 rounded-xl shadow-lg transition duration-300">
      ชำระเงินทันที
    </button>
  `;

  return html;
}

function renderPayment() {
  const bill = getCurrentBill();
  if (!bill) {
    return `
      <div class="bg-white p-12 text-center rounded-3xl shadow-sm border border-gray-100">
        <h3 class="text-xl font-bold text-gray-800 mb-2">ไม่มีค่าที่ต้องชำระ</h3>
        <div class="text-gray-500 mb-8">ขณะนี้ยังไม่มีรอบบิลใหม่</div>
        <button class="px-8 py-3 bg-gray-100 rounded-xl" onclick="goTo('dashboard')">
          กลับหน้าหลัก
        </button>
      </div>`;
  }
  const monthNames = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
];

const monthName = monthNames[parseInt(bill.BILLMONTH) - 1];

  const total = Number(bill.totalAmount);
  const waterCost = bill.waterUnit * bill.waterCost;
  const elecCost = bill.electricUnit * bill.electricCost;
  const roomRent = total - waterCost - elecCost;

  const room = localStorage.getItem("tenantRoomId") || "";
  const accActive = paymentMethod === "account";
  const qrActive = paymentMethod === "qr";

  let html = `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-800">ชำระค่าใช้จ่าย</h2>
        <div class="text-gray-500 mt-2">รอบบิล: ${monthName} ${bill.BILLYEAR}</div>
      </div>
      <button class="text-sm px-5 py-2 border rounded-xl" onclick="goTo('dashboard')">
        ย้อนกลับ
      </button>
    </div>

    <div class="flex flex-col lg:flex-row gap-8">
      <div class="flex-1 bg-white rounded-3xl shadow-sm border p-8">
        <h3 class="font-bold text-xl mb-6">1. ช่องทางการชำระเงิน</h3>

        <div class="flex gap-2 mb-8 bg-gray-50 p-1 rounded-2xl">
          <button class="flex-1 py-3 rounded-xl ${accActive ? 'bg-white shadow text-green-700' : ''}"
            onclick="setPaymentMethod('account')">
            โอนผ่านเลขบัญชี
          </button>
          <button class="flex-1 py-3 rounded-xl ${qrActive ? 'bg-white shadow text-green-700' : ''}"
            onclick="setPaymentMethod('qr')">
            สแกน QR Code
          </button>
        </div>

        <div class="bg-gray-50 border rounded-2xl p-8 mb-10 flex justify-center items-center min-h-[280px]">
    `;

  if (accActive) {
    html += `
          <div class="text-center">
            <div class="text-4xl font-bold tracking-widest mb-4">409-573-8599</div>
            <div class="text-lg mb-1">ญาทิชา จันทรศรีสุริยวงศ์</div>
            <div class="text-gray-500">ธนาคารไทยพาณิชย์</div>
          </div>
        `;
  } else {
    const qrData = encodeURIComponent(`APARTMENT:${room}:${total}`);
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;

    html += `
          <div class="text-center">
            <img src="${qrSrc}" class="w-56 h-56 mx-auto mb-4">
            <div class="text-gray-700">สแกนเพื่อชำระเงิน</div>
            <div class="text-green-600 font-bold text-xl mt-2">฿${total.toLocaleString()}</div>
          </div>
        `;
  }

  html += `
        </div>

        <h3 class="font-bold text-xl mb-5">2. อัปโหลดหลักฐานการโอน</h3>

        <label class="block cursor-pointer">
          <div class="border-2 border-dashed p-10 rounded-2xl text-center">
            คลิกเพื่ออัปโหลดสลิป
          </div>
          <input type="file" id="fileInput" accept="image/*" class="hidden">
        </label>

        ${uploadedSlip ? `<img src="${uploadedSlip}" class="mt-4 max-h-60 mx-auto"/>` : ""}

        <button class="w-full mt-8 bg-green-600 text-white py-4 rounded-xl font-bold"
          onclick="submitPayment()">
          ยืนยันการชำระเงิน
        </button>
      </div>

      <div class="w-full lg:w-80">
        <div class="bg-white rounded-3xl shadow-sm border p-8">
          <h3 class="font-bold text-xl mb-6 border-b pb-4 flex justify-between items-center">
            <span>สรุปยอดชำระ</span>
            <span class="border border-gray-300 bg-gray-50 px-4 py-1 rounded-lg text-sm font-semibold">
              ห้อง ${room}
            </span>
          </h3>

          <div class="space-y-4">
            <div class="flex justify-between"><span>ค่าเช่าห้อง</span><span>฿${roomRent.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>ค่าไฟฟ้า</span><span>฿${elecCost.toLocaleString()}</span></div>
            <div class="flex justify-between"><span>ค่าน้ำ</span><span>฿${waterCost.toLocaleString()}</span></div>
          </div>

          <div class="mt-8 pt-6 border-t text-center">
            <div class="text-gray-500 mb-2">ยอดรวมทั้งหมด</div>
            <div class="text-4xl font-bold text-green-600">฿${total.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  return html;
}

function renderHistory() {
  if (payments.length === 0) {
    return `
      <h2 class="text-3xl font-bold mb-6">ประวัติการชำระเงิน</h2>
      <div class="bg-white p-10 text-center rounded-xl">
        ยังไม่มีประวัติการชำระ
      </div>
    `;
  }

  let html = `
    <h2 class="text-3xl font-bold mb-6">ประวัติการชำระเงิน</h2>
    <div class="space-y-4">
  `;

  payments.forEach(p => {
    html += `
      <div class="bg-white p-6 rounded-xl shadow border">
        <div class="flex justify-between">
          <div>
            <p class="font-bold">${new Date(p.PAYDATE).toLocaleDateString("th-TH")}</p>
            <p class="text-gray-500">฿${Number(p.PAYAMOUNT).toLocaleString()}</p>
          </div>
          <div class="text-green-600 font-bold">${p.PAYSTATUS}</div>
        </div>
        ${p.PAYFILES ? `<a href="/uploads/${p.PAYFILES}" target="_blank" class="text-blue-600 underline">ดูสลิป</a>` : ""}
      </div>
    `;
  });

  html += "</div>";
  return html;
}

// --------------------------------------------------
// Payment Actions
// --------------------------------------------------
window.submitPayment = async function () {
  const bill = getCurrentBill();
  if (!bill) { alert("ไม่พบบิลที่ต้องชำระ"); return; }
  if (!uploadedFile) { alert("กรุณาอัปโหลดสลิป"); return; }

  try {

    const formData = new FormData();

    // billId
    formData.append("billId", bill.billId);

    // payAmount
    const payAmount = Number(bill.totalAmount);

    if (isNaN(payAmount) || payAmount <= 0) {
      alert("ยอดเงินไม่ถูกต้อง");
      return;
    }

    formData.append("payAmount", payAmount);

    // roomId
    const roomId = localStorage.getItem("tenantRoomId");
    if (roomId) {
      formData.append("roomId", roomId);
    }

    // accId
    const accId = localStorage.getItem("tenantAccId");
    if (accId) {
      formData.append("accId", accId);
    }

    // file
    formData.append("payFile", uploadedFile);

    console.log(">>> ส่งข้อมูล payment:", {
      billId: bill.billId,
      payAmount,
      roomId,
      accId
    });

    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      alert("ส่งสลิปเรียบร้อย รอแอดมินตรวจสอบ");

      uploadedSlip = null;
      uploadedFile = null;

      await loadPayments();
      await loadBills();

      activePage = "dashboard";
      render();
    } 
    else {
      alert("ส่งสลิปไม่สำเร็จ: " + (data.message || "ไม่ทราบสาเหตุ"));
    }

  } catch (err) {
    console.error("Submit error:", err);
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
};
// --------------------------------------------------
// Event Handlers & UI Controls
// --------------------------------------------------
function setPaymentMethod(method) {
  paymentMethod = method;
  render();
}

function goTo(page) {
  activePage = page;
  render();
}

function clearUpload() {
  uploadedSlip = null;
  uploadedFile = null;
  render();
}

function attachFileInputListener() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput) return;

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadedFile = file;

    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadedSlip = ev.target.result;
      render();
    };
    reader.readAsDataURL(file);
  });
}

function initEventListeners() {
  // Slip modal (ถ้ามีใน HTML)
  const slipModal = document.getElementById("slipModal");
  const closeSlip = document.getElementById("closeSlip");

  closeSlip?.addEventListener("click", () => {
    slipModal?.classList.add("hidden");
    slipModal?.classList.remove("flex");
  });
}
  // Mobile sidebar
  const mobileSidebar = document.getElementById("mobileSidebar");
  const mobileSidebarPanel = document.getElementById("mobileSidebarPanel");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const closeMobileMenuBtn = document.getElementById("closeMobileMenuBtn");

  function openMobileSidebar() {
    if (!mobileSidebar) return;
    mobileSidebar.classList.remove("hidden");
    setTimeout(() => {
      mobileSidebar.classList.remove("opacity-0");
      mobileSidebarPanel.classList.remove("-translate-x-full");
    }, 10);
  }

  function closeMobileSidebar() {
    if (!mobileSidebar) return;
    mobileSidebar.classList.add("opacity-0");
    mobileSidebarPanel.classList.add("-translate-x-full");
    setTimeout(() => mobileSidebar.classList.add("hidden"), 300);
  }

  mobileMenuBtn?.addEventListener("click", openMobileSidebar);
  closeMobileMenuBtn?.addEventListener("click", closeMobileSidebar);
  mobileSidebar?.addEventListener("click", (e) => {
    if (e.target === mobileSidebar) closeMobileSidebar();
  });


// Event Delegation สำหรับปุ่มเมนู (ทั้ง desktop sidebar และ mobile sidebar)
document.addEventListener('click', function(e) {
  // หาปุ่มที่มี data-page attribute
  const menuBtn = e.target.closest('[data-page]');
  if (menuBtn) {
    const page = menuBtn.dataset.page;
    if (page) {
      activePage = page;
      render();
      closeMobileSidebar();  // ปิด sidebar อัตโนมัติหลังเลือกเมนู
    }
  }
});

// --------------------------------------------------
// Global exposed functions (for onclick)
// --------------------------------------------------
window.setPaymentMethod = setPaymentMethod;
window.goTo = goTo;
window.clearUpload = clearUpload;
window.submitPayment = submitPayment;

// เรียก render ครั้งแรก (เผื่อกรณีที่ DOMContentLoaded ยังไม่ครบ)
render();