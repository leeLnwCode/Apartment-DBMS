const ROOM_API = "http://localhost:3000/api/rooms";
const BOOKING_API = "http://localhost:3000/api/bookings";

let currentRoom = null;


// get room from URL
function getQueryParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}


// load summary
async function loadBookingSummary() {

  const roomId = getQueryParameter("room");

  if (!roomId) return;
  const res = await fetch(`${ROOM_API}/${roomId}`);

  const room = await res.json();

  currentRoom = room;

  const deposit = Number(room.RPRICE) + 2500;

  document.getElementById("summaryRoom").textContent = room.ROOMID;

  document.getElementById("summaryPrice").textContent =
    "฿" + deposit.toLocaleString();

  document.getElementById("totalPrice").textContent =
    "฿" + deposit.toLocaleString();

  // Set the room image based on the room type
  const smallRooms = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
  const bedroomRooms = ['A5', 'B5'];

  let imageUrl = 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400';
  if (smallRooms.includes(roomId)) {
    imageUrl = 'asset/img/small.jpg';
  } else if (bedroomRooms.includes(roomId)) {
    imageUrl = 'asset/img/bedroom.jpg';
  }

  const summaryImage = document.getElementById("summaryImage");
  if (summaryImage) {
    summaryImage.src = imageUrl;
  }
}



// submit booking
async function submitBooking(event) {

  event.preventDefault();

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังส่งคำขอ...';
  }

  try {

    const roomId = getQueryParameter("room");

    const fullName = document.getElementById("fullName").value;
    const phone = document.getElementById("phone").value;
    const email = document.getElementById("email").value;

    const slipFile =
      document.getElementById("paymentSlip").files[0];

    if (!slipFile) {
      alert("กรุณาอัปโหลดสลิปก่อน");
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ยืนยันการจอง'; }
      return;
    }

    const formData = new FormData();

    formData.append("roomId", roomId);
    formData.append("fullName", fullName);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("payFile", slipFile);

    const res = await fetch(`${BOOKING_API}/create`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success)
      throw new Error(data.message);

    // Populate modal with booking details
    const deposit = currentRoom ? (Number(currentRoom.RPRICE) + 2500).toLocaleString() : '-';
    document.getElementById('modalRoom').textContent = roomId || '-';
    document.getElementById('modalName').textContent = fullName || '-';
    document.getElementById('modalPhone').textContent = phone || '-';
    document.getElementById('modalDeposit').textContent = '฿' + deposit;

    document.getElementById("successModal").classList.remove("hidden");

  } catch (err) {

    console.error(err);
    alert("จองไม่สำเร็จ: " + err.message);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ยืนยันการจอง'; }

  }

}



// toggle payment
function togglePaymentMethod() {

  const method =
    document.querySelector('input[name="paymentMethod"]:checked').value;

  if (method === "bank") {

    document.getElementById("bankSection")
      .classList.remove("hidden");

    document.getElementById("qrSection")
      .classList.add("hidden");

  } else {

    document.getElementById("bankSection")
      .classList.add("hidden");

    document.getElementById("qrSection")
      .classList.remove("hidden");

  }

}
function getQueryParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

document.addEventListener("DOMContentLoaded", () => {

  const roomId = getQueryParameter("room");

  // แก้ปุ่มกลับไป detail.html
  const backBtn = document.querySelector('a[href="detail.html"]');

  if (backBtn && roomId) {
    backBtn.href = `detail.html?room=${roomId}`;
  }

});

// init
document.addEventListener("DOMContentLoaded", () => {

  loadBookingSummary();

  document
    .getElementById("bookingForm")
    .addEventListener("submit", submitBooking);

});
