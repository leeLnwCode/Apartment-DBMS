// js/room.js
document.addEventListener('DOMContentLoaded', () => {

  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const roomGrid = document.getElementById('roomGrid');
  const availableOnly = document.getElementById('available-only');
  const loadingState = document.getElementById('loadingState');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  /* โหลดห้องจาก Database */
  async function loadRooms(showOnlyAvailable = false) {

    roomGrid.innerHTML = '';
    loadingState.classList.remove('hidden');

    try {

      const response = await fetch('http://localhost:3000/api/rooms');

      if (!response.ok)
        throw new Error('โหลดห้องไม่สำเร็จ');

      const rooms = await response.json();

      let pendingRooms = new Set();
      try {
        const bkRes = await fetch('http://localhost:3000/api/bookings');
        if (bkRes.ok) {
          const bookings = await bkRes.json();
          bookings.forEach(b => pendingRooms.add(b.ROOMID));
        }
      } catch (e) {
        console.error('โหลดข้อมูลการจองไม่สำเร็จ', e);
      }

      let filteredRooms = rooms;

      if (showOnlyAvailable) {
        filteredRooms = rooms.filter(room =>
          room.RSTATUS === 'AVAILABLE' && !pendingRooms.has(room.ROOMID)
        );
      }

      if (filteredRooms.length === 0) {
        roomGrid.innerHTML =
          '<p class="col-span-full text-center py-12 text-gray-600">ไม่พบห้อง</p>';
        return;
      }

      filteredRooms.forEach(room => {

        const isPending = pendingRooms.has(room.ROOMID);
        const isAvailable = room.RSTATUS === 'AVAILABLE';

        const card = document.createElement('article');

        card.className =
          'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition';

        let imageUrl = room.IMAGE_URL || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400';

        const smallRooms = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
        const bedroomRooms = ['A5', 'B5'];

        if (smallRooms.includes(room.ROOMID)) {
          imageUrl = 'asset/img/small.jpg';
        } else if (bedroomRooms.includes(room.ROOMID)) {
          imageUrl = 'asset/img/bedroom.jpg';
        }

        card.innerHTML = `
          <figure>
            <img src="${imageUrl}" 
                 class="w-full h-48 object-cover">
          </figure>

          <div class="p-4">

            <h3 class="text-xl font-bold mb-2">
              ห้อง ${room.ROOMID}
            </h3>

            <div class="flex justify-between items-center mb-4">

              <p class="text-green-700 font-bold text-lg">
                ฿${Number(room.RPRICE).toLocaleString()}/เดือน
              </p>

              <span class="${isPending
            ? 'bg-yellow-100 text-yellow-700'
            : isAvailable
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'} px-3 py-1 rounded-full text-sm font-semibold">

                ${isPending ? 'ติดจอง' : isAvailable ? 'ว่าง' : 'เต็ม'}

              </span>

            </div>

            ${isPending ? `
            <button
              disabled
              class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">

              ติดจอง

            </button>
            ` : isAvailable ? `
            <button
              onclick="goToDetail('${room.ROOMID}')"
              class="w-full bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg transition-colors font-semibold">

              ดูรายละเอียด

            </button>
            ` : `
            <button
              disabled
              class="w-full bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">

              เต็ม

            </button>
            `}

          </div>
        `;

        roomGrid.appendChild(card);

      });

    } catch (err) {

      console.error(err);

      roomGrid.innerHTML =
        '<p class="text-red-600 text-center">โหลดข้อมูลไม่สำเร็จ</p>';

    } finally {

      loadingState.classList.add('hidden');

    }
  }

  loadRooms();

  if (availableOnly) {

    availableOnly.addEventListener('change', () => {

      loadRooms(availableOnly.checked);

    });

  }

});


/* สำคัญมาก: ใช้ function นี้เพื่อไปหน้า detail */
function goToDetail(roomId) {
  window.location.href = `detail.html?room=${roomId}`;
}