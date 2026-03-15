document.addEventListener('DOMContentLoaded', function () {
  const API_BASE = "http://localhost:3000/api";

  let rooms = [];
  let bookingRequests = [];
  let roomChart = null;
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
  // Rooms
  // ────────────────────────────────────────────────
  async function loadAndRenderRooms() {
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch(`${API_BASE}/rooms`),
        fetch(`${API_BASE}/bookings`)
      ]);
      if (!roomsRes.ok) throw new Error('โหลดห้องไม่สำเร็จ');
      rooms = await roomsRes.json();

      const allBookings = bookingsRes.ok ? await bookingsRes.json() : [];
      const pendingCountMap = {};
      allBookings.forEach(b => {
        if (b.BKSTATUS === 'WAITING_VERIFY') {
          pendingCountMap[b.ROOMID] = (pendingCountMap[b.ROOMID] || 0) + 1;
        }
      });

      const tbody = document.getElementById('roomsTable');
      if (tbody) {
        tbody.innerHTML = '';
        rooms.forEach(room => {
          const isAvailable = room.RSTATUS === 'AVAILABLE';
          const statusText = isAvailable ? 'ว่าง' : 'เต็ม';
          const statusColor = isAvailable ? 'text-green-600' : 'text-red-600';
          const toggleBg = isAvailable ? 'bg-green-500' : 'bg-red-500';
          const dotPos = isAvailable ? '' : 'translate-x-5';

          const pendingCount = pendingCountMap[room.ROOMID] || 0;
          const remarkHtml = pendingCount > 0
            ? `<span class="inline-flex items-center gap-1 text-base font-medium text-yellow-800 bg-yellow-400 px-5 py-2 rounded-full">
                 ⚠ มีคำขอจอง ${pendingCount} รายการ
               </span>`
            : `<span class="text-gray-500 text-2xl">-</span>`;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="px-4 py-2 font-medium">${room.ROOMID}</td>
            <td class="px-4 py-2 ${statusColor}">${statusText}</td>
            <td class="px-4 py-2">฿${Number(room.RPRICE).toLocaleString()}</td>
            <td class="px-4 py-2">${remarkHtml}</td>
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
                  const approveData = await approveRes.json().catch(() => ({}));
                  if (!approveRes.ok) throw new Error(approveData.message || 'อนุมัติอัตโนมัติล้มเหลว');
                  alert('✓ อนุมัติอัตโนมัติเรียบร้อย! สร้าง Account และ Member เรียบร้อยแล้ว');
                  await loadBookingRequests();
                  await loadAndRenderRooms();
                } else {
                  e.target.checked = !isCheckedNow;
                }
              } catch (err) {
                console.error(err);
                alert('เกิดข้อผิดพลาด: ' + err.message);
              }
            }

            try {
              const updateRes = await fetch(`${API_BASE}/rooms/${roomId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
              });
              if (!updateRes.ok) throw new Error(await updateRes.text());
              loadAndRenderRooms();
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  // ────────────────────────────────────────────────
  // Bookings
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
        slip: row.PAYFILES
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
    if (filterVal) filtered = filtered.filter(r => r.requestDate?.startsWith(filterVal));

    container.innerHTML = '';
    filtered.forEach(r => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow mb-3';
      const dateStr = r.requestDate ? new Date(r.requestDate).toLocaleString('th-TH') : 'ไม่ระบุ';
      const detailsBtn = `<button data-id="${r.id}" class="view-booking-details px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 mt-2 whitespace-nowrap">ดูรายละเอียด</button>`;
      const action = r.status === 'WAITING_VERIFY'
        ? `<div class="flex flex-wrap gap-2 justify-end">
             <button data-id="${r.id}" class="approve-booking px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">อนุมัติ</button>
             <button data-slip="${r.slip}" class="view-slip px-4 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">ดูสลิป</button>
             ${detailsBtn}
           </div>`
        : `<div class="flex flex-col items-end gap-2">
             <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ อนุมัติแล้ว</span>
             ${detailsBtn}
           </div>`;

      div.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="font-medium text-lg">${r.name || 'ไม่ระบุ'}</div>
            <div class="text-sm text-gray-500">${r.phone || '-'}</div>
            <div class="text-sm text-gray-500">${dateStr}</div>
            <div class="text-sm mt-1">ห้อง: <strong class="text-green-700">${r.room}</strong></div>
          </div>
          <div class="flex flex-col items-end min-w-[120px]">${action}</div>
        </div>
      `;
      container.appendChild(div);
    });

    container.querySelectorAll('.view-slip').forEach(btn => btn.addEventListener('click', () => showSlipModal(btn.dataset.slip)));
    container.querySelectorAll('.view-booking-details').forEach(btn => btn.addEventListener('click', () => showBookingDetails(parseInt(btn.dataset.id))));
    container.querySelectorAll('.approve-booking').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookingId = btn.dataset.id;
        if (!confirm('ยืนยันหน้าการอนุมัติการจองนี้ใช่หรือไม่? ห้องจะถูกเปลี่ยนเป็น "เต็ม" ทันที')) return;
        try {
          const res = await fetch(`${API_BASE}/bookings/approve/${bookingId}`, { method: 'PUT' });
          const data = await res.json();
          if (res.ok && data.success) {
            alert('✓ อนุมัติการจองสำเร็จ! สร้าง Account และ Member เรียบร้อยแล้ว');
            await loadBookingRequests();
            await loadAndRenderRooms();
            renderUsers();
          } else {
            alert('เกิดข้อผิดพลาด: ' + (data.message || 'ไม่ทราบสาเหตุ'));
          }
        } catch (error) {
          console.error('Approve Error:', error);
          alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
        }
      });
    });
  }

  const bookingDetailsModal = document.getElementById('bookingDetailsModal');
  function showBookingDetails(id) {
    const r = bookingRequests.find(x => x.id === id);
    if (!r) return;
    const content = document.getElementById('bookingDetailsContent');
    if (!content) return;
    const dateStr = r.requestDate ? new Date(r.requestDate).toLocaleString('th-TH') : 'ไม่ระบุ';
    const statusText = r.status === 'WAITING_VERIFY'
      ? '<span class="text-amber-600 font-medium">รอการอนุมัติ</span>'
      : '<span class="text-green-600 font-medium">อนุมัติแล้ว</span>';
    content.innerHTML = `
      <div class="flex justify-between border-b pb-2"><span class="font-medium text-gray-500">รหัสการจอง:</span><span>${r.id}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">ห้องพัก:</span><span class="font-bold text-green-700">${r.room}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">ชื่อผู้จอง:</span><span>${r.name || '-'}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">เบอร์โทรศัพท์:</span><span>${r.phone || '-'}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">อีเมล:</span><span>${r.email || '-'}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">วันที่ทำรายการ:</span><span>${dateStr}</span></div>
      <div class="flex justify-between pt-2"><span class="font-medium text-gray-500">สถานะ:</span>${statusText}</div>
    `;
    bookingDetailsModal.classList.remove('hidden');
    bookingDetailsModal.classList.add('flex');
  }

  document.getElementById('closeBookingDetailsBtn')?.addEventListener('click', () => {
    bookingDetailsModal?.classList.add('hidden');
    bookingDetailsModal?.classList.remove('flex');
  });

  window.showSlipModal = function (fileName, title = "ตรวจสอบสลิปการชำระเงิน") {
    if (!fileName) { alert("ไม่มีสลิปสำหรับรายการนี้"); return; }
    const titleEl = document.getElementById("slipModalTitle");
    if (titleEl) titleEl.textContent = title;
    const img = document.getElementById("slipImg");
    if (img) {
      img.src = `http://localhost:3000/uploads/slips/${fileName}`;
      img.onerror = () => { img.src = 'https://via.placeholder.com/400x600?text=ไม่พบสลิป'; };
    }
    const modal = document.getElementById("slipModal");
    if (modal) { modal.classList.remove("hidden"); modal.classList.add("flex"); }
  };

  function closeSlipModal() {
    const modal = document.getElementById("slipModal");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  }

  document.addEventListener("click", (e) => {
    const modal = document.getElementById("slipModal");
    if (modal && modal.classList.contains("flex") && !e.target.closest(".bg-white")) closeSlipModal();
  });
  document.getElementById("closeSlip")?.addEventListener("click", closeSlipModal);

  // ────────────────────────────────────────────────
  // Page Switching
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
    if (name === 'dashboard') { loadBookingRequests(); loadAndRenderRooms(); }
    if (name === 'bills') loadBillsFromAPI();
    if (name === 'payments') {
      const typeFilter = document.getElementById('filterPaymentType');
      const monthFilter = document.getElementById('filterPayments');
      if (typeFilter && !typeFilter.value) typeFilter.value = 'monthly';
      if (monthFilter && !monthFilter.value) {
        const now = new Date();
        monthFilter.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      loadPayments();
    }
  }

  pageBtns.forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
  document.getElementById('filterBills')?.addEventListener('change', renderBills);
  document.getElementById('filterPayments')?.addEventListener('change', renderPayments);
  document.getElementById('filterPaymentType')?.addEventListener('change', renderPayments);

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
  mobileSidebar?.addEventListener('click', e => { if (e.target === mobileSidebar) closeMobileSidebar(); });

  // ────────────────────────────────────────────────
  // Bills
  // ────────────────────────────────────────────────
  function getMonthName(month) {
    return ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"][month - 1] || month;
  }

  async function loadBillsFromAPI() {
    const res = await fetch("http://localhost:3000/api/bills");
    const data = await res.json();
    if (data.success) {
      bills = data.data.map(b => {
        const billIdValue = b.BILLID || b.billId || b.billid || null;
        const parsedId = billIdValue ? Number(billIdValue) : null;
        if (parsedId === null || isNaN(parsedId)) console.warn("[WARNING] บิลนี้ไม่มี BILLID ที่ถูกต้อง:", b);
        return {
          id: parsedId, billId: parsedId,
          room: b.ROOMID || b.roomId,
          total: Number(b.TOTALAMOUNT || b.totalAmount || 0),
          roomId: b.ROOMID || b.roomId,
          totalAmount: Number(b.TOTALAMOUNT || b.totalAmount || 0),
          waterUnit: Number(b.WATERUNIT || b.waterUnit || 0),
          electricUnit: Number(b.ELECTRICUNIT || b.electricUnit || 0),
          waterCost: Number(b.WATERCOST || b.waterCost || 0),
          elecCost: Number(b.ELECTRICCOST || b.electricCost || 0) * Number(b.ELECTRICUNIT || b.electricUnit || 0),
          roomPrice: Number(b.TOTALAMOUNT || b.totalAmount || 0)
            - (Number(b.WATERCOST || b.waterCost || 0) * Number(b.WATERUNIT || b.waterUnit || 0))
            - (Number(b.ELECTRICCOST || b.electricCost || 0) * Number(b.ELECTRICUNIT || b.electricUnit || 0)),
          month: b.BILLMONTH || b.billMonth,
          year: b.BILLYEAR || b.billYear
        };
      });
      renderBills();
    }
  }

  function renderBills() {
    const container = document.getElementById('billsList');
    if (!container) return;
    container.innerHTML = '';
    const filterVal = document.getElementById('filterBills')?.value;
    let filtered = bills;
    if (filterVal) {
      const parts = filterVal.split('-');
      if (parts.length === 2) {
        const filterYear = parseInt(parts[0], 10);
        const filterMonth = parseInt(parts[1], 10);
        filtered = filtered.filter(b => b.year === filterYear && b.month === filterMonth);
      }
    }
    if (filtered.length === 0) { container.innerHTML = '<div class="text-gray-500 text-center py-4">ไม่พบข้อมูล</div>'; return; }
    filtered.forEach(b => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow flex items-center justify-between';
      const editId = b.id || b.billId || '';
      div.innerHTML = `
        <div>
          <div class="font-medium text-lg text-gray-800">ห้อง ${b.room}</div>
          <div class="text-sm text-gray-500">${getMonthName(b.month)} ${b.year}</div>
          <div class="text-sm mt-1">ราคา: <span class="text-green-600 font-medium">฿${b.total.toLocaleString()}</span></div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${b.id}" class="view-bill px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium">รายละเอียด</button>
          <button data-id="${editId}" class="edit-bill px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded text-sm font-medium">แก้ไข</button>
          <button data-id="${b.id}" class="delete-bill px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium">ลบ</button>
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
    rooms.forEach(r => { billRoomSel.innerHTML += `<option value="${r.ROOMID}" data-price="${r.RPRICE}">${r.ROOMID} (฿${r.RPRICE})</option>`; });
  }

  document.getElementById('showAddBillModal')?.addEventListener('click', () => {
    populateRoomOptions();
    billForm.reset();
    document.getElementById('billId').value = '';
    document.getElementById('billModalTitle').textContent = 'เพิ่มบิลใหม่';
    document.getElementById('billYear').value = new Date().getFullYear();
    calcRoomPrice.textContent = '฿0'; calcWaterCost.textContent = '฿0';
    calcElecCost.textContent = '฿0'; calcTotalCost.textContent = '฿0';
    billModal.classList.remove('hidden'); billModal.classList.add('flex');
  });

  document.getElementById('cancelBillBtn')?.addEventListener('click', closeBillModal);
  function closeBillModal() {
    if (billModal) { billModal.classList.remove('flex'); billModal.classList.add('hidden'); }
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
    if (!room) return;
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
    const billIdInput = document.getElementById('billId').value?.trim() || '';
    const billId = billIdInput ? Number(billIdInput) : null;
    if (billIdInput && isNaN(billId)) { alert("BILLID ไม่ถูกต้อง"); return; }
    const billMonth = document.getElementById('billMonth').value;
    const billYear = document.getElementById('billYear').value;
    const roomId = billRoomSel.value?.trim();
    if (!roomId || !billMonth || !billYear) { alert("ข้อมูลไม่ครบถ้วน"); return; }
    const prevW = parseFloat(document.getElementById('prevWater').value) || 0;
    const currW = parseFloat(document.getElementById('currWater').value) || 0;
    const prevE = parseFloat(document.getElementById('prevElec').value) || 0;
    const currE = parseFloat(document.getElementById('currElec').value) || 0;
    const usedW = Math.max(0, currW - prevW);
    const usedE = Math.max(0, currE - prevE);
    const url = billId ? `http://localhost:3000/api/bills/${billId}` : `http://localhost:3000/api/bills`;
    const method = billId ? "PUT" : "POST";
    const payload = { roomId, waterUnit: usedW, electricUnit: usedE, waterCost: 25, electricCost: 7, billMonth, billYear };
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { alert(billId ? "แก้ไขบิลสำเร็จ" : "สร้างบิลสำเร็จ"); await loadBillsFromAPI(); closeBillModal(); }
      else alert("บันทึกไม่สำเร็จ: " + (data.message || "ไม่ทราบสาเหตุ"));
    } catch (err) { alert("เกิดข้อผิดพลาด: " + err.message); }
  });

  async function deleteBill(id) {
    if (!confirm('คุณต้องการลบบิลนี้ใช่หรือไม่?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/bills/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { alert("ลบบิลสำเร็จ"); await loadBillsFromAPI(); }
      else alert("ลบไม่สำเร็จ: " + data.message);
    } catch (err) { alert("เกิดข้อผิดพลาด"); }
  }

  function openEditBill(id) {
    const numericId = Number(id);
    if (isNaN(numericId) || numericId <= 0) { alert("ไม่สามารถแก้ไขได้: BILLID ไม่ถูกต้อง"); return; }
    const b = bills.find(x => Number(x.id) === numericId || Number(x.billId) === numericId);
    if (!b) { alert("ไม่พบบิลนี้ในรายการ กรุณารีเฟรชหน้าแล้วลองใหม่"); return; }
    populateRoomOptions();
    billForm.reset();
    document.getElementById('billModalTitle').textContent = 'แก้ไขบิล';
    document.getElementById('billId').value = b.billId || b.id || '';
    billRoomSel.value = b.room || b.roomId;
    const monthMap = {"มกราคม":1,"กุมภาพันธ์":2,"มีนาคม":3,"เมษายน":4,"พฤษภาคม":5,"มิถุนายน":6,"กรกฎาคม":7,"สิงหาคม":8,"กันยายน":9,"ตุลาคม":10,"พฤศจิกายน":11,"ธันวาคม":12};
    let monthValue = b.month || b.BILLMONTH;
    if (typeof monthValue === "string" && isNaN(monthValue)) monthValue = monthMap[monthValue.trim()];
    document.getElementById('billMonth').value = Number(monthValue) || 1;
    document.getElementById('billYear').value = b.year || b.BILLYEAR || new Date().getFullYear();
    document.getElementById('prevWater').value = 0;
    document.getElementById('currWater').value = b.waterUnit || 0;
    document.getElementById('prevElec').value = 0;
    document.getElementById('currElec').value = b.electricUnit || 0;
    calculatePreview();
    billModal.classList.remove('hidden'); billModal.classList.add('flex');
  }

  const billDetailsModal = document.getElementById('billDetailsModal');
  function showBillDetails(id) {
    const b = bills.find(x => x.id === id);
    if (!b) return;
    const content = document.getElementById('billDetailsContent');
    if (!content) return;
    content.innerHTML = `
      <div class="flex justify-between border-b pb-2"><span class="font-medium text-gray-500">ห้องพัก:</span><span class="font-bold">ห้อง ${b.room}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">รอบบิล:</span><span>${getMonthName(b.month)} ${b.year}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">ค่าห้องพัก:</span><span>฿${b.roomPrice.toLocaleString()}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">ค่าน้ำ (${b.waterUnit} ยูนิต):</span><span>฿${b.waterCost.toLocaleString()}</span></div>
      <div class="flex justify-between border-b pb-2 pt-2"><span class="font-medium text-gray-500">ค่าไฟ (${b.electricUnit} หน่วย):</span><span>฿${b.elecCost.toLocaleString()}</span></div>
      <div class="flex justify-between pt-2 mt-2"><span class="font-bold text-lg">รวมทั้งหมด:</span><span class="font-bold text-lg text-green-600">฿${b.total.toLocaleString()}</span></div>
    `;
    billDetailsModal.classList.remove('hidden'); billDetailsModal.classList.add('flex');
  }

  document.getElementById('closeBillDetailsBtn')?.addEventListener('click', () => {
    billDetailsModal?.classList.add('hidden'); billDetailsModal?.classList.remove('flex');
  });

  // ────────────────────────────────────────────────
  // Payments
  // ────────────────────────────────────────────────
  async function loadPayments() {
    try {
      const res = await fetch("http://localhost:3000/api/payments");
      const result = await res.json();
      payments = result.data || [];
      renderPayments();
    } catch (err) { console.error("โหลด payment ไม่สำเร็จ", err); }
  }

  function renderPayments() {
    const container = document.getElementById('paymentsList');
    if (!container) return;
    const filterVal = document.getElementById('filterPayments')?.value;
    const filterType = document.getElementById('filterPaymentType')?.value;
    let filtered = payments;
    if (filterVal) filtered = filtered.filter(p => p.PAYDATE?.startsWith(filterVal));
    if (filterType === 'monthly') filtered = filtered.filter(p => !p.BOOKINGID);
    else if (filterType === 'booking') filtered = filtered.filter(p => p.BOOKINGID);
    container.innerHTML = filtered.length === 0 ? '<div class="text-gray-500 text-center py-4">ไม่พบข้อมูล</div>' : '';
    filtered.forEach(p => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow flex flex-col md:flex-row md:items-center justify-between gap-4';
      const dateStr = p.PAYDATE ? new Date(p.PAYDATE).toLocaleString('th-TH') : '';
      div.innerHTML = `
        <div class="space-y-1">
          <div class="font-medium text-lg flex items-center gap-2">
            ห้อง ${p.ROOMID}
            <span class="text-xs px-2 py-0.5 rounded-full font-semibold ${p.BOOKINGID ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
              ${p.BOOKINGID ? 'การจอง' : 'การชำระเงินรายเดือน'}
            </span>
          </div>
          <div class="text-sm text-gray-600">ราคา: <span class="text-green-600 font-medium">฿${p.PAYAMOUNT}</span></div>
          <div class="text-sm text-gray-500">วันที่จ่าย: ${dateStr}</div>
        </div>
        <div>${p.PAYFILES
          ? `<button onclick="showSlipModal('${p.PAYFILES}', 'ตรวจสอบสลิปการชำระเงิน')" class="px-4 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100 font-medium">ดูสลิป</button>`
          : `<span class="text-gray-400 text-sm">ไม่มีสลิป</span>`}
        </div>
      `;
      container.appendChild(div);
    });
  }

  // ────────────────────────────────────────────────
  // Users
  // ────────────────────────────────────────────────
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
        div.className = 'bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md';
        div.innerHTML = `
          <div class="space-y-3 flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold text-sm">ห้อง ${u.ROOMID}</div>
              <div class="font-bold text-lg text-gray-800">
                ${u.MEMNAME || '<span class="text-gray-400 italic font-normal text-sm">ไม่มีข้อมูลลูกบ้าน</span>'}
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 pl-1 mt-3 border-t pt-3 border-gray-50">
              <div>
                <span class="font-semibold block text-gray-700 mb-2">ข้อมูลติดต่อ</span>
                <div class="flex items-center gap-2 mt-1">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  ${u.MEMPHONE || '-'}
                </div>
                <div class="flex items-center gap-2 mt-1">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  ${u.MEMEMAIL || '-'}
                </div>
              </div>
              <div>
                <span class="font-semibold block text-gray-700 mb-2">ข้อมูลเข้าสู่ระบบ</span>
                <div class="mt-1">Username: <span class="font-medium bg-gray-100 px-2 py-0.5 rounded">${u.ACCUSER}</span></div>
                <!-- แก้ไข: ไม่แสดง password hash ให้เห็น แสดงเป็น *** แทน -->
                <div class="mt-1">Password: <span class="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-400">••••••••</span></div>
              </div>
            </div>
          </div>
          <div class="self-end md:self-center mt-4 md:mt-0 flex gap-2">
            <button data-id="${u.ACCID}" class="edit-user px-4 py-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-lg text-sm font-semibold border border-yellow-100 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              แก้ไข
            </button>
            <button data-id="${u.ACCID}" class="delete-user px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold border border-red-100 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              ปิดใช้งาน
            </button>
          </div>
        `;
        container.appendChild(div);
      });

      container.querySelectorAll('.edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = users.find(x => String(x.ACCID) === String(btn.dataset.id));
          if (u) openEditUserModal(u);
        });
      });
      container.querySelectorAll('.delete-user').forEach(btn => btn.addEventListener('click', () => deleteUser(btn.dataset.id)));

    } catch (err) {
      console.error(err);
      container.innerHTML = '<div class="text-red-500">โหลดข้อมูลไม่สำเร็จ</div>';
    }
  }

  async function deleteUser(id) {
    if (!confirm('คุณต้องการปิดใช้งานผู้ใช้งานนี้ใช่หรือไม่?')) return;
    try {
      const response = await fetch(`http://localhost:3000/api/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      alert('ปิดใช้งานสำเร็จ');
      renderUsers();
    } catch (err) { alert('ดำเนินการไม่สำเร็จ'); console.error(err); }
  }

  const userModal = document.getElementById('userModal');
  const userForm = document.getElementById('userForm');
  const userRoomSel = document.getElementById('userRoom');
  let editingUserId = null;

  function populateUserRoomOptions() {
    if (!userRoomSel) return;
    userRoomSel.innerHTML = '<option value="">-- เลือกห้อง --</option>';
    rooms.forEach(r => { userRoomSel.innerHTML += `<option value="${r.ROOMID}">${r.ROOMID}</option>`; });
  }

  document.getElementById('showAddUserModal')?.addEventListener('click', () => {
    editingUserId = null;
    populateUserRoomOptions();
    userForm.reset();
    document.getElementById('userModalTitle').textContent = 'เพิ่มผู้ใช้งานและข้อมูลลูกบ้าน';
    document.getElementById('userRoom').disabled = false;
    document.getElementById('userUsername').disabled = false;
    userModal.classList.remove('hidden'); userModal.classList.add('flex');
  });

  function openEditUserModal(user) {
    editingUserId = user.ACCID;
    populateUserRoomOptions();
    userForm.reset();
    document.getElementById('userModalTitle').textContent = 'แก้ไขข้อมูลผู้ใช้งานและลูกบ้าน';
    document.getElementById('userRoom').value = user.ROOMID;
    document.getElementById('userRoom').disabled = true;
    document.getElementById('userUsername').value = user.ACCUSER;
    document.getElementById('userUsername').disabled = true;
    // แก้ไข: ไม่ดึง hash มาใส่ใน input — ให้ผู้ดูแลกรอก password ใหม่เองถ้าต้องการเปลี่ยน
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'เว้นว่างถ้าไม่ต้องการเปลี่ยนรหัสผ่าน';
    document.getElementById('userName').value = user.MEMNAME || '';
    document.getElementById('userPhone').value = user.MEMPHONE || '';
    document.getElementById('userEmail').value = user.MEMEMAIL || '';
    userModal.classList.remove('hidden'); userModal.classList.add('flex');
  }

  document.getElementById('cancelUserBtn')?.addEventListener('click', closeUserModal);
  function closeUserModal() {
    if (userModal) { userModal.classList.remove('flex'); userModal.classList.add('hidden'); }
  }

  userForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roomId = userRoomSel.value;
    const username = document.getElementById('userUsername').value;
    const password = document.getElementById('userPassword').value;
    const memName = document.getElementById('userName').value;
    const memPhone = document.getElementById('userPhone').value;
    const memEmail = document.getElementById('userEmail').value;

    if (!editingUserId) {
      const existingUser = users.find(u => u.ROOMID === roomId);
      if (existingUser) { alert(`ไม่สามารถเพิ่มได้ เนื่องจากมีผู้ใช้งานในห้อง ${roomId} อยู่แล้ว`); return; }
      try {
        const response = await fetch('http://localhost:3000/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, accUser: username, accPass: password, memName, memPhone, memEmail })
        });
        if (!response.ok) throw new Error((await response.json()).message || 'เกิดข้อผิดพลาด');
        alert('เพิ่มผู้ใช้และข้อมูลลูกบ้านสำเร็จ');
        closeUserModal(); renderUsers();
      } catch (err) { alert('เพิ่มไม่สำเร็จ: ' + err.message); }
    } else {
      try {
        const payload = { memName, memPhone, memEmail };
        // แก้ไข: ส่ง password เฉพาะเมื่อกรอกมาเท่านั้น
        if (password) payload.accPass = password;
        const response = await fetch(`http://localhost:3000/api/users/edit/${editingUserId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error((await response.json()).message || 'เกิดข้อผิดพลาด');
        alert('แก้ไขข้อมูลสำเร็จ');
        closeUserModal(); renderUsers();
      } catch (err) { alert('แก้ไขไม่สำเร็จ: ' + err.message); }
    }
  });

  /// ================================================================
// แทนที่ส่วน Contracts ใน admin-dashboard.js ด้วยโค้ดนี้ทั้งหมด
// ================================================================

  // ────────────────────────────────────────────────
  // โหลด contracts จาก API
  // ────────────────────────────────────────────────
  async function loadContractsFromAPI() {
    try {
      const res = await fetch(`${API_BASE}/contracts`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      if (!data.success || !Array.isArray(data.contracts)) {
        contracts = [];
      } else {
        contracts = data.contracts.map(c => ({
          id:           c.CONTRACTID,
          room:         c.ROOMID      || '-',
          memId:        c.MEMID,
          memName:      c.MEMNAME     || '-',
          startDate:    c.CONTRACT_START_DATE,
          endDate:      c.CONTRACT_END_DATE,
          rentPrice:    Number(c.RENT_PRICE)              || 0,
          deposit:      Number(c.DEPOSIT_AMOUNT)          || 0,
          waterPrice:   Number(c.WATER_PRICE_PER_UNIT)    || 0,
          elecPrice:    Number(c.ELECTRIC_PRICE_PER_UNIT) || 0,
          status:       c.STATUS      || '-',
          fileName:     c.CONTRACTFILE || null,
          fileUrl:      c.CONTRACTFILE
                          ? `http://localhost:3000/uploads/${c.CONTRACTFILE}`
                          : null,
          createdAt:    c.CREATED_AT,
        }));
      }
      renderContracts();
    } catch (err) {
      console.error("โหลด contracts ไม่สำเร็จ:", err);
    }
  }

  // ────────────────────────────────────────────────
  // render รายการสัญญา
  // ────────────────────────────────────────────────
  function renderContracts() {
    const container = document.getElementById("contractsList");
    if (!container) return;

    const filterVal = document.getElementById("filterContracts")?.value;
    let filtered = contracts;
    if (filterVal) {
      filtered = filtered.filter(c => {
        if (!c.startDate) return false;
        const d = new Date(c.startDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}` === filterVal;
      });
    }

    container.innerHTML = "";
    if (filtered.length === 0) {
      container.innerHTML = '<div class="text-gray-500 text-center py-4">ไม่พบข้อมูล</div>';
      return;
    }

    filtered.forEach(c => {
      const startStr  = c.startDate  ? new Date(c.startDate).toLocaleDateString('th-TH')  : '-';
      const endStr    = c.endDate    ? new Date(c.endDate).toLocaleDateString('th-TH')    : '-';
      const statusBadge = c.status === 'active'
        ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">active</span>'
        : c.status === 'expired'
          ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">expired</span>'
          : `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">${c.status}</span>`;

      const div = document.createElement("div");
      div.className = "bg-white p-4 rounded shadow";
      div.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-lg">ห้อง ${c.room}</span>
              ${statusBadge}
            </div>
            <div class="text-sm text-gray-600">สมาชิก: <span class="font-medium">${c.memName}</span></div>
            <div class="text-sm text-gray-500">สัญญา: ${startStr} — ${endStr}</div>
            <div class="text-sm text-gray-500">
              ค่าเช่า: <span class="font-medium text-green-700">฿${c.rentPrice.toLocaleString()}</span>
              &nbsp;|&nbsp; มัดจำ: <span class="font-medium">฿${c.deposit.toLocaleString()}</span>
              &nbsp;|&nbsp; น้ำ: ${c.waterPrice}฿/ยูนิต
              &nbsp;|&nbsp; ไฟ: ${c.elecPrice}฿/หน่วย
            </div>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            ${c.fileUrl
              ? `<a href="${c.fileUrl}" target="_blank"
                   class="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100 font-medium">ดูไฟล์</a>
                 <a href="${c.fileUrl}" download
                   class="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium">ดาวน์โหลด</a>`
              : `<span class="text-gray-400 text-sm self-center">ไม่มีไฟล์</span>`
            }
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  // ────────────────────────────────────────────────
  // Modal elements
  // ────────────────────────────────────────────────
  const contractModal    = document.getElementById("contractModal");
  const contractForm     = document.getElementById("contractForm");
  const contractRoomSel  = document.getElementById("contractRoom");
  const contractMemSel   = document.getElementById("contractMem");

  // ────────────────────────────────────────────────
  // โหลด dropdown ห้อง
  // ────────────────────────────────────────────────
  function populateContractRoomOptions() {
    if (!contractRoomSel) return;
    contractRoomSel.innerHTML = '<option value="">-- เลือกห้อง --</option>';
    rooms.forEach(r => {
      contractRoomSel.innerHTML += `<option value="${r.ROOMID}" data-price="${r.RPRICE}">${r.ROOMID} (฿${Number(r.RPRICE).toLocaleString()})</option>`;
    });
  }

  // ────────────────────────────────────────────────
  // โหลด dropdown สมาชิก (ดึงจาก API)
  // ────────────────────────────────────────────────
  async function populateContractMemOptions(filterRoomId = null) {
    if (!contractMemSel) return;
    contractMemSel.innerHTML = '<option value="">กำลังโหลด...</option>';

    try {
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      const allUsers = data.users || [];

      contractMemSel.innerHTML = '<option value="">-- เลือกสมาชิก --</option>';

      // ถ้าเลือกห้องแล้ว ให้กรองแสดงเฉพาะสมาชิกในห้องนั้น ถ้าไม่ได้เลือกแสดงทั้งหมด
      const filtered = filterRoomId
        ? allUsers.filter(u => String(u.ROOMID) === String(filterRoomId))
        : allUsers;

      if (filtered.length === 0) {
        contractMemSel.innerHTML = '<option value="">ไม่พบสมาชิกในห้องนี้</option>';
        return;
      }

      filtered.forEach(u => {
        contractMemSel.innerHTML += `<option value="${u.MEMID}">
          [${u.ROOMID}] ${u.MEMNAME || u.ACCUSER} (MEMID: ${u.MEMID})
        </option>`;
      });
    } catch (err) {
      console.error("โหลดสมาชิกไม่สำเร็จ:", err);
      contractMemSel.innerHTML = '<option value="">โหลดไม่สำเร็จ</option>';
    }
  }

  // ────────────────────────────────────────────────
  // เมื่อเลือกห้อง → กรองสมาชิกตามห้อง + เติมค่าเช่าอัตโนมัติ
  // ────────────────────────────────────────────────
  contractRoomSel?.addEventListener("change", async () => {
    const roomId = contractRoomSel.value;
    await populateContractMemOptions(roomId || null);

    // เติมค่าเช่าจากราคาห้องอัตโนมัติ
    if (roomId) {
      const room = rooms.find(r => r.ROOMID === roomId);
      if (room) {
        document.getElementById('contractRentPrice').value  = room.RPRICE || '';
        document.getElementById('contractDeposit').value    = (Number(room.RPRICE) * 2) || '';
      }
    }
  });

  // ────────────────────────────────────────────────
  // เปิด modal เพิ่มสัญญา
  // ────────────────────────────────────────────────
  document.getElementById("showAddContractModal")?.addEventListener("click", async () => {
    contractForm.reset();
    document.getElementById('contractWaterPrice').value = '25';
    document.getElementById('contractElecPrice').value  = '7';

    // วันเริ่มต้น = วันนี้, วันสิ้นสุด = 1 ปีถัดไป
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    document.getElementById('contractStartDate').value = today.toISOString().split('T')[0];
    document.getElementById('contractEndDate').value   = nextYear.toISOString().split('T')[0];

    populateContractRoomOptions();
    await populateContractMemOptions();

    contractModal.classList.remove("hidden");
    contractModal.classList.add("flex");
  });

  // ────────────────────────────────────────────────
  // ปิด modal
  // ────────────────────────────────────────────────
  document.getElementById("cancelContractBtn")?.addEventListener("click", () => {
    contractModal.classList.add("hidden");
    contractModal.classList.remove("flex");
  });

  // ────────────────────────────────────────────────
  // submit เพิ่มสัญญา — ส่งข้อมูลครบทุก field
  // ────────────────────────────────────────────────
  contractForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const roomId              = document.getElementById('contractRoom').value;
    const memId               = document.getElementById('contractMem').value;
    const contractStartDate   = document.getElementById('contractStartDate').value;
    const contractEndDate     = document.getElementById('contractEndDate').value;
    const rentPrice           = document.getElementById('contractRentPrice').value;
    const depositAmount       = document.getElementById('contractDeposit').value;
    const waterPricePerUnit   = document.getElementById('contractWaterPrice').value;
    const electricPricePerUnit = document.getElementById('contractElecPrice').value;
    const fileInput           = document.getElementById('contractFile');

    // validation เบื้องต้น
    if (!roomId || !memId || !contractStartDate || !contractEndDate || !rentPrice || !depositAmount) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }
    if (new Date(contractEndDate) <= new Date(contractStartDate)) {
      alert("วันสิ้นสุดสัญญาต้องหลังวันเริ่มสัญญา");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("roomId",               roomId);
      formData.append("memId",                memId);
      formData.append("contractStartDate",    contractStartDate);
      formData.append("contractEndDate",      contractEndDate);
      formData.append("rentPrice",            rentPrice);
      formData.append("depositAmount",        depositAmount);
      formData.append("waterPricePerUnit",    waterPricePerUnit   || '25');
      formData.append("electricPricePerUnit", electricPricePerUnit || '7');

      // ไฟล์ไม่บังคับ
      if (fileInput.files.length > 0) {
        formData.append("contractFile", fileInput.files[0]);
      }

      const res = await fetch(`${API_BASE}/contracts`, {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (!result.success) {
        alert("เพิ่มสัญญาไม่สำเร็จ: " + (result.message || "ไม่ทราบสาเหตุ"));
        return;
      }

      alert("เพิ่มสัญญาสำเร็จ!");
      contractModal.classList.add("hidden");
      contractModal.classList.remove("flex");
      await loadContractsFromAPI();

    } catch (err) {
      console.error("เพิ่มสัญญา error:", err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  });

  document.getElementById('filterContracts')?.addEventListener('change', renderContracts);
  // ────────────────────────────────────────────────
  // Filter events & Initial Load
  // ────────────────────────────────────────────────
  document.getElementById('filterRequests')?.addEventListener('change', renderRequests);
  document.getElementById('filterPayments')?.addEventListener('change', renderPayments);
  document.getElementById('filterContracts')?.addEventListener('change', renderContracts);

  loadBookingRequests();
  loadAndRenderRooms();
  loadBillsFromAPI();
  renderPayments();
  renderUsers();
  loadContractsFromAPI();
  renderRecentRequests();
  showPage('dashboard');
});