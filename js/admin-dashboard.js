
document.addEventListener('DOMContentLoaded', function () {
  const API_BASE = "http://localhost:3000/api";

  let rooms = [];
  let bookingRequests = [];
  let roomChart = null;

  // ข้อมูล mock/local ที่ยังคงไว้
  const roomMeters = {
    'A1': { water: 100, elec: 500 },
    'A2': { water: 120, elec: 600 },
    'A3': { water: 140, elec: 700 },
    'A4': { water: 100, elec: 500 },
    'A5': { water: 100, elec: 500 },
    'B1': { water: 100, elec: 500 },
    'B2': { water: 100, elec: 500 },
    'B3': { water: 100, elec: 500 },
    'B4': { water: 100, elec: 500 },
    'B5': { water: 100, elec: 500 },
  };

  let bills = [];

  let payments = [];

  let users = [];

  let contracts = [];

  // ────────────────────────────────────────────────
  // โหลดและแสดงห้องจากฐานข้อมูลจริง + toggle status
  // ────────────────────────────────────────────────
  async function loadAndRenderRooms() {
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      if (!res.ok) throw new Error('โหลดห้องไม่สำเร็จ');
      rooms = await res.json();

      const tbody = document.getElementById('roomsTable');
      if (tbody) {
        tbody.innerHTML = '';
        rooms.forEach(room => {
          const isAvailable = room.RSTATUS === 'AVAILABLE';
          const statusText = isAvailable ? 'ว่าง' : 'เต็ม';
          const statusColor = isAvailable ? 'text-green-600' : 'text-red-600';
          const toggleBg = isAvailable ? 'bg-green-500' : 'bg-red-500';
          const dotPos = isAvailable ? '' : 'translate-x-5';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="px-4 py-2 font-medium">${room.ROOMID}</td>
            <td class="px-4 py-2 ${statusColor}">${statusText}</td>
            <td class="px-4 py-2">฿${Number(room.RPRICE).toLocaleString()}</td>
            <td class="px-4 py-2 text-center">
              <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" data-room="${room.ROOMID}" class="toggle-switch sr-only" ${isAvailable ? 'checked' : ''} />
                <span class="w-11 h-6 rounded-full relative transition-colors ${toggleBg}" aria-hidden="true">
                  <span class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${dotPos}"></span>
                </span>
              </label>
            </td>
          `;
          tbody.appendChild(tr);
        });

        // ผูก event toggle
        document.querySelectorAll('.toggle-switch').forEach(checkbox => {
          checkbox.addEventListener('change', async (e) => {
            const roomId = e.target.dataset.room;
            const isCheckedNow = e.target.checked;
            const newStatus = isCheckedNow ? 'AVAILABLE' : 'OCCUPIED';

            if (!isCheckedNow) {
              try {
                const pendingRes = await fetch(`${API_BASE}/bookings/pending/${roomId}`);
                const pending = await pendingRes.json();
                if (pending.hasPending) {
                  if (!confirm(`ห้อง ${roomId} มีคำขอจองรอตรวจสอบ ต้องการอนุมัติอัตโนมัติเลยไหม?`)) {
                    e.target.checked = true;
                    return;
                  }
                  const approveRes = await fetch(`${API_BASE}/bookings/auto-approve/${roomId}`, { method: 'POST' });
                  if (!approveRes.ok) throw new Error('อนุมัติอัตโนมัติล้มเหลว');
                  alert('อนุมัติอัตโนมัติเรียบร้อย');
                  loadBookingRequests();
                }
              } catch (err) {
                console.error(err);
              }
            }

            try {
              const updateRes = await fetch(`${API_BASE}/rooms/${roomId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
              });
              if (!updateRes.ok) throw new Error(await updateRes.text());
              loadAndRenderRooms(); // refresh
            } catch (err) {
              alert('อัปเดตสถานะล้มเหลว: ' + err.message);
              e.target.checked = !isCheckedNow;
            }
          });
        });
      }

      renderCounts();
      renderChart();

    } catch (err) {
      console.error('โหลดห้องล้มเหลว:', err);
      alert('โหลดข้อมูลห้องไม่สำเร็จ: ' + err.message);
    }
  }

  // ────────────────────────────────────────────────
  // Counts & Chart (ปรับใช้ข้อมูลจริง)
  // ────────────────────────────────────────────────
  function renderCounts() {
    const total = rooms.length;
    const available = rooms.filter(r => r.RSTATUS === 'AVAILABLE').length;
    const occupied = total - available;

    document.getElementById('totalRooms').textContent = total || '--';
    document.getElementById('availableRooms').textContent = available || '--';
    document.getElementById('occupiedRooms').textContent = occupied || '--';
  }

  function renderChart() {
    const available = rooms.filter(r => r.RSTATUS === 'AVAILABLE').length;
    const occupied = rooms.length - available;
    const ctx = document.getElementById('roomChart');
    if (!ctx) return;

    const data = {
      labels: ['ว่าง', 'เต็ม'],
      datasets: [{ data: [available, occupied], backgroundColor: ['#16a34a', '#ef4444'] }]
    };

    if (roomChart) {
      roomChart.data = data;
      roomChart.update();
      return;
    }

    roomChart = new Chart(ctx.getContext('2d'), {
      type: 'pie',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  // ────────────────────────────────────────────────
  // Booking Requests
  // ────────────────────────────────────────────────
  async function loadBookingRequests() {
    try {
      const res = await fetch(`${API_BASE}/bookings`);
      if (!res.ok) throw new Error('โหลดคำขอจองล้มเหลว');
      const data = await res.json();

      console.log("BOOKINGS:", data);

      bookingRequests = data.map(row => ({
        id: row.BOOKINGID,
        room: row.ROOMID,
        name: row.BNAME,
        phone: row.BPHONE,
        email: row.BEMAIL,
        status: row.BKSTATUS,
        requestDate: row.BKDATE,
        slip: `${API_BASE}/payments/slip/${row.PAYID}`
      }));

      renderRequests();
      renderRecentRequests();

    } catch (err) {
      console.error("โหลด booking ไม่สำเร็จ", err);
    }
  }

  function renderRecentRequests() {
    const container = document.getElementById('recentRequests');
    if (!container) return;

    const sorted = [...bookingRequests]
      .sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
      .slice(0, 3);

    container.innerHTML = '';
    sorted.forEach(r => {
      const div = document.createElement('div');
      div.className = "p-3 border rounded bg-white";
      div.innerHTML = `
        <div class="font-medium">${r.name || 'ไม่ระบุ'}</div>
        <div class="text-sm text-gray-600">ห้อง ${r.room}</div>
      `;
      container.appendChild(div);
    });
  }


  function renderRequests() {
    const container = document.getElementById('requestsList');
    if (!container) return;


    const filterVal = document.getElementById('filterRequests')?.value;
    let filtered = bookingRequests;
    if (filterVal) {
      filtered = filtered.filter(r => r.requestDate?.startsWith(filterVal));
    }

    container.innerHTML = '';
    filtered.forEach(r => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow mb-3';
      const dateStr = r.requestDate ? new Date(r.requestDate).toLocaleString('th-TH') : 'ไม่ระบุ';

      const action = r.status === 'WAITING_VERIFY'
        ? `<button data-slip="${r.slip}" class="view-slip px-4 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">ดูสลิป</button>`
        : `<span class="text-green-600 font-medium">ยืนยันแล้ว</span>`;

      div.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <div class="font-medium">${r.name || 'ไม่ระบุ'}</div>
            <div class="text-sm text-gray-500">${r.phone || ''}</div>
            <div class="text-sm text-gray-500">${dateStr}</div>
            <div class="text-sm">ห้อง: <strong>${r.room}</strong></div>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${action}
          </div>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll('.view-slip').forEach(btn => {
      btn.addEventListener('click', () => showSlipModal(btn.dataset.slip));
    });
  }

  // ────────────────────────────────────────────────
  // Slip Modal
  // ────────────────────────────────────────────────
  function showSlipModal(file){

  const img = document.getElementById("slipImg");

  img.src = `${API_BASE}/uploads/${file}`;

  document.getElementById("slipModal").classList.remove("hidden");

}

  function closeSlipModal() {
    const modal = document.getElementById('slipModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  document.addEventListener('click', e => {
    if (e.target.id === 'slipModal') closeSlipModal();
  });
  document.getElementById('closeSlip')?.addEventListener('click', closeSlipModal);

  // ────────────────────────────────────────────────
  // Page Switching + Mobile Sidebar
  // ────────────────────────────────────────────────
  const pageBtns = document.querySelectorAll('.page-btn');
  const views = document.querySelectorAll('.page-view');

  function showPage(name) {
    views.forEach(v => v.classList.add('hidden'));
    const el = document.getElementById(name);
    if (el) el.classList.remove('hidden');

    pageBtns.forEach(b => {
      b.classList.remove('bg-green-50');
      if (b.dataset.page === name) b.classList.add('bg-green-50');
    });

    closeMobileSidebar();

    if (name === 'dashboard') {
      loadBookingRequests();
      loadAndRenderRooms();
    }

    if (name === 'bills') {
    loadBillsFromAPI();
  }

  if (name === 'payments') {
    loadPayments();
  }
}

  pageBtns.forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

  const mobileSidebar = document.getElementById('mobileSidebar');
  const mobileSidebarPanel = document.getElementById('mobileSidebarPanel');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');

  function openMobileSidebar() {
    if (!mobileSidebar) return;
    mobileSidebar.classList.remove('hidden');
    setTimeout(() => {
      mobileSidebar.classList.remove('opacity-0');
      if (mobileSidebarPanel) mobileSidebarPanel.classList.remove('-translate-x-full');
    }, 10);
  }

  function closeMobileSidebar() {
    if (!mobileSidebar) return;
    mobileSidebar.classList.add('opacity-0');
    if (mobileSidebarPanel) mobileSidebarPanel.classList.add('-translate-x-full');
    setTimeout(() => mobileSidebar.classList.add('hidden'), 300);
  }

  mobileMenuBtn?.addEventListener('click', openMobileSidebar);
  closeMobileMenuBtn?.addEventListener('click', closeMobileSidebar);
  mobileSidebar?.addEventListener('click', e => {
    if (e.target === mobileSidebar) closeMobileSidebar();
  });

  // ────────────────────────────────────────────────
  // Bills Section (mock data)
  // ────────────────────────────────────────────────
  function getMonthName(month) {
  const months = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
    "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
    "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
  ];
  return months[month - 1] || month;
}
 async function loadBillsFromAPI() {
  const res = await fetch("http://localhost:3000/api/bills");
  const data = await res.json();

  if (data.success) {

    bills = data.data.map(b => ({

      // ใช้ใน admin
      id: b.billId,
      room: b.roomId,
      total: b.totalAmount,

      // ใช้ใน member payment
      billId: b.billId,
      roomId: b.roomId,
      totalAmount: b.totalAmount,

      // รายละเอียด
      waterUnit: b.waterUnit,
      electricUnit: b.electricUnit,

      waterCost: b.waterCost * b.waterUnit,
      elecCost: b.electricCost * b.electricUnit,

      roomPrice: b.totalAmount -
        (b.waterCost * b.waterUnit) -
        (b.electricCost * b.electricUnit),

      month: b.BILLMONTH,
      year: b.BILLYEAR

    }));

    renderBills();
  }
}
function renderBills() {
    const container = document.getElementById('billsList');
    if (!container) return;
    container.innerHTML = '';
    bills.forEach(b => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow flex items-center justify-between';
      div.innerHTML = `
        <div>
          <div class="font-medium text-lg text-gray-800">ห้อง ${b.room}</div>
         <div class="text-sm text-gray-500">${getMonthName(b.month)} ${b.year}</div>
          <div class="text-sm mt-1">ราคา: <span class="text-green-600 font-medium">฿${b.total.toLocaleString()}</span></div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${b.id}" class="view-bill px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium transition-colors">รายละเอียด</button>
          <button data-id="${b.id}" class="edit-bill px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-sm font-medium transition-colors">แก้ไข</button>
          <button data-id="${b.id}" class="delete-bill px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition-colors">ลบ</button>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll('.view-bill').forEach(btn => btn.addEventListener('click', () => showBillDetails(parseInt(btn.dataset.id))));
    container.querySelectorAll('.edit-bill').forEach(btn => btn.addEventListener('click', () => openEditBill(parseInt(btn.dataset.id))));
    container.querySelectorAll('.delete-bill').forEach(btn => btn.addEventListener('click', () => deleteBill(parseInt(btn.dataset.id))));
  }

  
  const billModal = document.getElementById('billModal');
  const billForm = document.getElementById('billForm');
  const billRoomSel = document.getElementById('billRoom');
  const calcRoomPrice = document.getElementById('calcRoomPrice');
  const calcWaterCost = document.getElementById('calcWaterCost');
  const calcElecCost = document.getElementById('calcElecCost');
  const calcTotalCost = document.getElementById('calcTotalCost');

  function populateRoomOptions() {
    if (!billRoomSel) return;
    billRoomSel.innerHTML = '<option value="">-- เลือกห้อง --</option>';
    rooms.forEach(r => {
      billRoomSel.innerHTML += `<option value="${r.ROOMID}" data-price="${r.RPRICE}">${r.ROOMID} (฿${r.RPRICE})</option>`;
    });
  }

  document.getElementById('showAddBillModal')?.addEventListener('click', () => {
    populateRoomOptions();
    billForm.reset();
    document.getElementById('billId').value = '';
    document.getElementById('billModalTitle').textContent = 'เพิ่มบิลใหม่';
    document.getElementById('billYear').value = new Date().getFullYear();
    calcRoomPrice.textContent = '฿0';
    calcWaterCost.textContent = '฿0';
    calcElecCost.textContent = '฿0';
    calcTotalCost.textContent = '฿0';
    billModal.classList.remove('hidden');
    billModal.classList.add('flex');
  });

  document.getElementById('cancelBillBtn')?.addEventListener('click', closeBillModal);

  function closeBillModal() {
    if (billModal) {
      billModal.classList.remove('flex');
      billModal.classList.add('hidden');
    }
  }

 billRoomSel?.addEventListener('change', async () => {
  const roomId = billRoomSel.value;
  if (!roomId) return;

  const res = await fetch(`http://localhost:3000/api/bills/last/${roomId}`);
  const data = await res.json();

  if (data.success) {
    document.getElementById('prevWater').value = data.data.water;
    document.getElementById('prevElec').value = data.data.elec;
  }

  calculatePreview();
});

  document.getElementById('currWater')?.addEventListener('input', calculatePreview);
  document.getElementById('currElec')?.addEventListener('input', calculatePreview);

  function calculatePreview() {
  const roomId = billRoomSel.value;
  if (!roomId) return;

  const room = rooms.find(r => r.ROOMID === roomId);
  if (!room) {
    console.log("Room not found in rooms array");
    return;
  }

  const roomPrice = Number(room.RPRICE) || 0;

  const prevW = parseFloat(document.getElementById('prevWater').value) || 0;
  const currW = parseFloat(document.getElementById('currWater').value) || 0;
  const prevE = parseFloat(document.getElementById('prevElec').value) || 0;
  const currE = parseFloat(document.getElementById('currElec').value) || 0;

  const usedW = Math.max(0, currW - prevW);
  const usedE = Math.max(0, currE - prevE);

  const costW = usedW * 25;
  const costE = usedE * 7;

  const total = roomPrice + costW + costE;

  calcRoomPrice.textContent = `฿${roomPrice}`;
  calcWaterCost.textContent = `฿${costW} (${usedW} ยูนิต)`;
  calcElecCost.textContent = `฿${costE} (${usedE} หน่วย)`;
  calcTotalCost.textContent = `฿${total}`;
}

  billForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
const billMonth = document.getElementById('billMonth').value;
const billYear = document.getElementById('billYear').value;
  const roomId = billRoomSel.value;
  const room = rooms.find(r => r.ROOMID === roomId);
  if (!room) return;

  const prevW = parseFloat(document.getElementById('prevWater').value) || 0;
  const currW = parseFloat(document.getElementById('currWater').value) || 0;
  const prevE = parseFloat(document.getElementById('prevElec').value) || 0;
  const currE = parseFloat(document.getElementById('currElec').value) || 0;

  const usedW = Math.max(0, currW - prevW);
  const usedE = Math.max(0, currE - prevE);

  const waterCost = 25;
  const electricCost = 7;

  try {
    const res = await fetch("http://localhost:3000/api/bills", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
  roomId,
  waterUnit: usedW,
  electricUnit: usedE,
  waterCost,
  electricCost,
  billMonth,
  billYear
})
    });

    const data = await res.json();

    if (data.success) {
      alert("สร้างบิลสำเร็จ");

      // รีโหลดจาก API ใหม่
      await loadBillsFromAPI();

      closeBillModal();
    } else {
      alert("สร้างบิลไม่สำเร็จ: " + data.message);
    }

  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
  }
});


  async function deleteBill(id) {
  if (!confirm('คุณต้องการลบบิลนี้ใช่หรือไม่?')) return;

  try {
    const res = await fetch(`http://localhost:3000/api/bills/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (data.success) {
      alert("ลบบิลสำเร็จ");
      await loadBillsFromAPI();
    } else {
      alert("ลบไม่สำเร็จ: " + data.message);
    }

  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาด");
  }
}

  function openEditBill(id) {

  const b = bills.find(x => x.id === id);
  if (!b) return;

  populateRoomOptions();

  billForm.reset();

  document.getElementById('billModalTitle').textContent = 'แก้ไขบิล';

  document.getElementById('billId').value = b.id;

  billRoomSel.value = b.room;

  document.getElementById('billMonth').value = b.month;
  document.getElementById('billYear').value = b.year;

  // ใช้ unit เดิมแทน
  document.getElementById('prevWater').value = 0;
  document.getElementById('currWater').value = b.waterUnit;

  document.getElementById('prevElec').value = 0;
  document.getElementById('currElec').value = b.electricUnit;

  calculatePreview();

  billModal.classList.remove('hidden');
  billModal.classList.add('flex');

}

  const billDetailsModal = document.getElementById('billDetailsModal');
  function showBillDetails(id) {
  const b = bills.find(x => x.id === id);
  if (!b) return;

  const content = document.getElementById('billDetailsContent');
  if (!content) return;

    content.innerHTML = `
      <div class="flex justify-between border-b pb-2">
        <span class="font-medium text-gray-500">ห้องพัก:</span><span class="font-bold text-gray-800">ห้อง ${b.room}</span>
      </div>
      <div class="flex justify-between border-b pb-2 pt-2">
        <span class="font-medium text-gray-500">รอบบิล:</span><span class="font-bold text-gray-800">${getMonthName(b.month)} ${b.year}</span>
      </div>
      <div class="flex justify-between border-b pb-2 pt-2">
        <span class="font-medium text-gray-500">ค่าห้องพัก:</span><span class="text-gray-800">฿${b.roomPrice.toLocaleString()}</span>
      </div>
      <div class="flex justify-between border-b pb-2 pt-2">
        <span class="font-medium text-gray-500">ค่าน้ำ (${b.waterUnit} ยูนิต):</span><span class="text-gray-800">฿${b.waterCost.toLocaleString()}</span>
      </div>
      <div class="flex justify-between border-b pb-2 pt-2">
        <span class="font-medium text-gray-500">ค่าไฟ (${b.electricUnit} หน่วย):</span><span class="text-gray-800">฿${b.elecCost.toLocaleString()}</span>
      </div>
      <div class="flex justify-between pt-2 mt-2">
        <span class="font-bold text-lg text-gray-800">รวมทั้งหมด:</span><span class="font-bold text-lg text-green-600">฿${b.total.toLocaleString()}</span>
      </div>
    `;
    billDetailsModal.classList.remove('hidden');
    billDetailsModal.classList.add('flex');
  }

  document.getElementById('closeBillDetailsBtn')?.addEventListener('click', () => {
    billDetailsModal?.classList.add('hidden');
    billDetailsModal?.classList.remove('flex');
  });


async function loadPayments() {
  try {

    const res = await fetch("http://localhost:3000/api/payments");
    const result = await res.json();

    console.log("API result:", result);
    console.log("API data:", result.data);

    payments = result.data || [];

    console.log("payments after set:", payments);

    renderPayments();

  } catch (err) {
    console.error("โหลด payment ไม่สำเร็จ", err);
  }
}


  function renderPayments() {

  const container = document.getElementById('paymentsList');
  if (!container) return;
console.log("payments data:", payments);
  const filterVal = document.getElementById('filterPayments')?.value;

  let filtered = payments;

  if (filterVal) {
    filtered = filtered.filter(p =>
  p.PAYDATE?.includes(filterVal)
);
  }

  container.innerHTML = filtered.length === 0
    ? '<div class="text-gray-500 text-center py-4">ไม่พบข้อมูล</div>'
    : '';

  filtered.forEach(p => {

    const div = document.createElement('div');

    div.className = 'bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center justify-between gap-4';

    const dateStr = p.PAYDATE
      ? new Date(p.PAYDATE).toLocaleString('th-TH')
      : '';

    div.innerHTML = `
      <div class="space-y-1">
        <div class="font-medium text-lg">ห้อง ${p.ROOMID}</div>
        <div class="text-sm text-gray-600">
          ราคา: <span class="text-green-600 font-medium">฿${p.PAYAMOUNT}</span>
        </div>
        <div class="text-sm text-gray-500">
          วันที่จ่าย: ${dateStr}
        </div>
      </div>

      <div>
        ${p.PAYFILES
          ? `<button data-slip="${p.PAYFILES}"
              class="view-payment-slip px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded text-sm">
              ดูสลิป
            </button>`
          : ''}
      </div>
    `;

    container.appendChild(div);

  });

  container.querySelectorAll('.view-payment-slip').forEach(btn => {

    btn.addEventListener('click', () => {

      showSlipModal(btn.dataset.slip);

    });

  });

}

// Render users (Database version)
async function renderUsers() {

  const container = document.getElementById('usersList');
  if (!container) return;

  container.innerHTML = 'กำลังโหลด...';

  try {

    const response = await fetch('http://localhost:3000/api/users');
    const result = await response.json();

    users = result.users;

    container.innerHTML = '';

    users.forEach(u => {

      const div = document.createElement('div');

      div.className = 'bg-white p-4 rounded shadow flex items-center justify-between';

      div.innerHTML = `
        <div class="space-y-1">
          <div class="font-medium text-lg text-gray-800">
            ห้อง ${u.ROOMID}
          </div>

          <div class="text-sm text-gray-600">
            ชื่อผู้ใช้:
            <span class="font-medium">${u.ACCUSER}</span>
          </div>

          <div class="text-sm text-gray-600">
            รหัสผ่าน:
            <span class="font-medium">${u.ACCPASS}</span>
          </div>
        </div>

        <div>
          <button data-id="${u.ACCID}"
            class="delete-user px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition-colors">
            ลบ
          </button>
        </div>
      `;

      container.appendChild(div);

    });

    container.querySelectorAll('.delete-user').forEach(btn => {

      btn.addEventListener('click', () => {

        deleteUser(btn.dataset.id);

      });

    });

  } catch (err) {

    console.error(err);

    container.innerHTML = '<div class="text-red-500">โหลดข้อมูลไม่สำเร็จ</div>';

  }

}

  async function deleteUser(id) {

  if (!confirm('คุณต้องการลบผู้ใช้งานนี้ใช่หรือไม่?')) return;

  try {

    const response = await fetch(
      `http://localhost:3000/api/users/${id}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.ok) {
      throw new Error();
    }

    alert('ลบสำเร็จ');

    renderUsers();

  } catch (err) {

    alert('ลบไม่สำเร็จ');

    console.error(err);

  }

}

  // --- User Modal & Logic ---
  const userModal = document.getElementById('userModal');
  const userForm = document.getElementById('userForm');
  const userRoomSel = document.getElementById('userRoom');

  function populateUserRoomOptions() {
    if (!userRoomSel) return;
    userRoomSel.innerHTML = '<option value="">-- เลือกห้อง --</option>';
    rooms.forEach(r => {
      userRoomSel.innerHTML += `<option value="${r.ROOMID}">${r.ROOMID}</option>`;
    });
  }

  document.getElementById('showAddUserModal')?.addEventListener('click', () => {
    populateUserRoomOptions();
    userForm.reset();
    userModal.classList.remove('hidden');
    userModal.classList.add('flex');
  });

  document.getElementById('cancelUserBtn')?.addEventListener('click', closeUserModal);

  function closeUserModal() {
    if (userModal) {
      userModal.classList.remove('flex');
      userModal.classList.add('hidden');
    }
  }

  userForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomId = userRoomSel.value;

    // Check if room already has a user
    const existingUser = users.find(u => u.room === roomId);
    if (existingUser) {
      alert(`ไม่สามารถเพิ่มผู้ใช้งานได้ เนื่องจากมีผู้ใช้งานในห้อง ${roomId} อยู่แล้ว`);
      return;
    }

    const username = document.getElementById('userUsername').value;
    const password = document.getElementById('userPassword').value;

    try {
      const response = await fetch(
        'http://localhost:3000/api/users',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          roomId: roomId,
          accUser: username,
          accPass: password
        })
      }
    );

    if (!response.ok) {
      throw new Error();
    }

    alert('เพิ่มผู้ใช้สำเร็จ');

    closeUserModal();

    renderUsers();

  } catch (err) {

    alert('เพิ่มไม่สำเร็จ');

    console.error(err);

  }

});

 // ────────────────────────────────────────────────
// Contracts Section (FULL VERSION: API + ADD WORKING)
// ────────────────────────────────────────────────


// ────────────────────────────────────────────────
// โหลด contracts จาก database
// ────────────────────────────────────────────────
async function loadContractsFromAPI() {

  try {

    const res = await fetch(`${API_BASE}/contracts`);

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    const data = await res.json();

    console.log("API result:", data);

    if (!data.success || !Array.isArray(data.contracts)) {

      contracts = [];

    } else {

      contracts = data.contracts.map(c => ({

        id: c.CONTRACID,

        room: c.ROOMID || "-",

        uploadDate: c.UPLOADDATE
          ? new Date(c.UPLOADDATE).toISOString()
          : new Date().toISOString(),

        fileName: c.CONTRACTFILE || "unknown",

       fileUrl:
  `http://localhost:3000/uploads/${c.CONTRACTFILE}`

      }));

    }

    renderContracts();

  } catch (err) {

    console.error("โหลด contracts ไม่สำเร็จ:", err);

  }

}


// ────────────────────────────────────────────────
// render contracts
// ────────────────────────────────────────────────
function renderContracts() {

  const container =
    document.getElementById("contractsList");

  if (!container) return;

  const filterVal =
    document.getElementById("filterContracts")?.value;

  let filtered = contracts;

  if (filterVal) {

    filtered = filtered.filter(c =>
      c.uploadDate.startsWith(filterVal)
    );

  }

  container.innerHTML = "";

  if (filtered.length === 0) {

    container.innerHTML =
      '<div class="text-gray-500 text-center py-4">ไม่พบข้อมูล</div>';

    return;

  }

  filtered.forEach(c => {

    const div = document.createElement("div");

    div.className =
      "bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center justify-between gap-4";

    div.innerHTML = `
      <div>

        <div class="font-medium text-lg">
          ห้อง ${c.room}
        </div>

        <div class="text-sm text-gray-600">
          วันที่อัปโหลด:
          ${new Date(c.uploadDate).toLocaleDateString("th-TH")}
        </div>

        <div class="text-sm text-gray-600">
          ไฟล์:
          ${c.fileName}
        </div>

      </div>

      <div class="flex gap-2">

        <a href="${c.fileUrl}"
           target="_blank"
           class="px-3 py-1 bg-blue-500 text-white rounded">
           ดู
        </a>

        <a href="${c.fileUrl}"
           download
           class="px-3 py-1 bg-green-500 text-white rounded">
           ดาวน์โหลด
        </a>

      </div>
    `;

    container.appendChild(div);

  });

}


// ────────────────────────────────────────────────
// Modal elements
// ────────────────────────────────────────────────

const contractModal =
  document.getElementById("contractModal");

const contractForm =
  document.getElementById("contractForm");

const contractRoomSel =
  document.getElementById("contractRoom");


// ────────────────────────────────────────────────
// เติม dropdown ห้อง
// ────────────────────────────────────────────────
function populateContractRoomOptions() {

  if (!contractRoomSel) return;

  contractRoomSel.innerHTML =
    '<option value="">-- เลือกห้อง --</option>';

  rooms.forEach(r => {

    contractRoomSel.innerHTML +=
      `<option value="${r.ROOMID}">
        ${r.ROOMID}
      </option>`;

  });

}


// ────────────────────────────────────────────────
// เปิด modal
// ────────────────────────────────────────────────
document.getElementById("showAddContractModal")
?.addEventListener("click", () => {

  populateContractRoomOptions();

  contractForm.reset();

  contractModal.classList.remove("hidden");

  contractModal.classList.add("flex");

});


// ────────────────────────────────────────────────
// ปิด modal
// ────────────────────────────────────────────────
document.getElementById("cancelContractBtn")
?.addEventListener("click", () => {

  contractModal.classList.add("hidden");

  contractModal.classList.remove("flex");

});


// ────────────────────────────────────────────────
// เพิ่ม contract (ส่งไป database)
// ────────────────────────────────────────────────
contractForm?.addEventListener("submit",
async (e) => {

  e.preventDefault();

  const roomId = contractRoomSel.value;

  const fileInput =
    document.getElementById("contractFile");

  if (!roomId) {

    alert("กรุณาเลือกห้อง");

    return;

  }

  if (fileInput.files.length === 0) {

    alert("กรุณาเลือกไฟล์");

    return;

  }

  const file = fileInput.files[0];

  try {

    const formData = new FormData();

    formData.append("roomId", roomId);

    formData.append("contractFile", file);

    const res = await fetch(
      `${API_BASE}/contracts`,
      {

        method: "POST",

        body: formData

      }
    );

    const result = await res.json();

    console.log("upload result:", result);

    if (!result.success) {

      alert("เพิ่มไม่สำเร็จ");

      return;

    }

    alert("เพิ่มสำเร็จ");

    contractModal.classList.add("hidden");

    contractModal.classList.remove("flex");

    await loadContractsFromAPI();

  } catch (err) {

    console.error(err);

    alert("เกิดข้อผิดพลาด");

  }

});


// ────────────────────────────────────────────────
// โหลดเมื่อเปิดหน้า
// ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  loadContractsFromAPI();
  loadBillsFromAPI();

});

  // ────────────────────────────────────────────────
  // Filter Events
  // ────────────────────────────────────────────────
  document.getElementById('filterRequests')?.addEventListener('change', renderRequests);
  document.getElementById('filterPayments')?.addEventListener('change', renderPayments);
  document.getElementById('filterContracts')?.addEventListener('change', renderContracts);
  
  // ────────────────────────────────────────────────
  // Initial Load
  // ────────────────────────────────────────────────
  loadBookingRequests();
  loadAndRenderRooms();
  loadBillsFromAPI();
  renderPayments();
  renderUsers();
  loadContractsFromAPI();
  renderRecentRequests();

  showPage('dashboard');
});
