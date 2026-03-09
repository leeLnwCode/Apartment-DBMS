// ข้อมูลห้องทั้งหมด
const roomsData = {
  'A1': { name: 'ห้อง A1', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800' },
  'A2': { name: 'ห้อง A2', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
  'A3': { name: 'ห้อง A3', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800' },
  'A4': { name: 'ห้อง A4', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
  'A5': { name: 'ห้อง A5', price: 3200, deposit: 5700, signingDay: 3200, status: 'available', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
  'B1': { name: 'ห้อง B1', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800' },
  'B2': { name: 'ห้อง B2', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800' },
  'B3': { name: 'ห้อง B3', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800' },
  'B4': { name: 'ห้อง B4', price: 3000, deposit: 5500, signingDay: 3000, status: 'available', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800' },
  'B5': { name: 'ห้อง B5', price: 3200, deposit: 5700, signingDay: 3200, status: 'available', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800' }
};
let currentImageIndex = 0;

let images = [];

function setupRoomImages(roomId) {
  const smallRooms = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
  const bedroomRooms = ['A5', 'B5'];

  if (smallRooms.includes(roomId)) {
    images = ['asset/img/small.jpg', 'asset/img/bathroom.jpg', 'asset/img/balcony.jpg'];
  } else if (bedroomRooms.includes(roomId)) {
    images = ['asset/img/bedroom.jpg', 'asset/img/living_room.jpg', 'asset/img/bathroom.jpg', 'asset/img/balcony.jpg'];
  } else {
    images = ['asset/img/small.jpg'];
  }

  const thumbContainer = document.getElementById('thumbnailContainer');
  if (thumbContainer) {
    thumbContainer.innerHTML = '';
    images.forEach((img, index) => {
      thumbContainer.innerHTML += `<img src="${img}" alt="Thumb ${index + 1}" class="rounded-lg h-24 w-full object-cover cursor-pointer hover:opacity-80" onclick="setImage(${index})">`;
    });
  }
  updateImage();
}

function getQueryParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}
async function loadRoomData() {
  const roomId = getQueryParameter("room");

  if (!roomId) {
    document.body.innerHTML = "<h1 class='text-3xl font-bold text-red-600 text-center mt-10'>ไม่พบ Room ID</h1>";
    return;
  }

  // กำหนดรูปภาพของห้อง
  setupRoomImages(roomId);

  let room = roomsData[roomId];
  let isPending = false;

  // ลองดึงจาก API เสมอเพื่อเอาข้อมูลล่าสุด
  try {
    const resp = await fetch(`http://localhost:3000/api/rooms/${roomId}`);
    if (resp.ok) {
      const dbRoom = await resp.json();
      room = {
        name: `ห้อง ${dbRoom.ROOMID}`,
        price: dbRoom.RPRICE,
        deposit: 5500,
        signingDay: dbRoom.RPRICE,
        status: dbRoom.RSTATUS === 'AVAILABLE' ? 'available' : 'full',
        image: dbRoom.IMAGE_URL || images[0]
      };
    }

    // Check if room has pending bookings
    const pbResp = await fetch(`http://localhost:3000/api/bookings/pending/${roomId}`);
    if (pbResp.ok) {
      const pbData = await pbResp.json();
      if (pbData.hasPending) {
        if (room) room.status = 'pending';
      }
    }
  } catch (e) { }

  if (!room) {
    document.body.innerHTML = "<h1 class='text-3xl font-bold text-red-600 text-center mt-10'>ไม่พบข้อมูลห้อง</h1>";
    return;
  }

  document.querySelector('h1').textContent = room.name;
  document.querySelector('.text-3xl.font-bold.mb-4').textContent = `฿${room.price}/เดือน`;
  document.querySelector('.text-xl.font-semibold.mb-2').textContent = `ยอดชำระค่าเงินมัดจำการจองห้องพัก: ฿${room.deposit}`;
  document.querySelector('.text-xl.font-semibold.mb-6').textContent = `ยอดที่ต้องชำระในวันทำสัญญา: ฿${room.signingDay}`;

  const statusBadge = document.querySelector('.bg-green-100');
  if (room.status === 'full') {
    statusBadge.className = 'bg-red-100 text-red-700 px-4 py-2 rounded-full font-semibold text-sm';
    statusBadge.textContent = 'เต็ม';
    document.querySelector('button:nth-of-type(1)').className = 'w-full bg-gray-400 text-white py-3 rounded-lg font-bold text-lg cursor-not-allowed';
    document.querySelector('button:nth-of-type(1)').disabled = true;
    document.querySelector('button:nth-of-type(1)').textContent = 'เต็มแล้ว';
  } else if (room.status === 'pending') {
    statusBadge.className = 'bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-semibold text-sm';
    statusBadge.textContent = 'ติดจอง';
    document.querySelector('button:nth-of-type(1)').className = 'w-full bg-gray-400 text-white py-3 rounded-lg font-bold text-lg cursor-not-allowed';
    document.querySelector('button:nth-of-type(1)').disabled = true;
    document.querySelector('button:nth-of-type(1)').textContent = 'ติดจอง';
  } else {
    statusBadge.textContent = 'ว่าง';
  }
}

function goToBooking() {
  const roomId = getQueryParameter("room");
  window.location.href = `booking.html?room=${roomId}`;
}

function prevImage() {
  currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
  updateImage();
}

function nextImage() {
  currentImageIndex = (currentImageIndex + 1) % images.length;
  updateImage();
}

function setImage(index) {
  currentImageIndex = index;
  updateImage();
}

function updateImage() {
  const mainImg = document.getElementById("mainImage");
  if (mainImg) {
    mainImg.src = images[currentImageIndex];
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      const menu = document.getElementById('mobileMenu');
      menu.classList.toggle('hidden');
    });
  }

  loadRoomData();
});