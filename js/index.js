document.addEventListener('DOMContentLoaded', function () {
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      const menu = document.getElementById('mobileMenu');
      if (menu) menu.classList.toggle('hidden');
    });
  }
});

fetch("http://localhost:3000/rooms")
  .then(res => res.json())
  .then(data => {

    console.log(data);

    const container = document.getElementById("room-list");

    data.forEach(room => {

      container.innerHTML += `
            <div>
                Room: ${room.room_number}
                Price: ${room.price}
            </div>
        `;

    });

  });