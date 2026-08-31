const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".menu");

function setMenu(open) {
  if (!menuToggle || !menu) return;
  menu.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}

if (menuToggle && menu) {
  menuToggle.addEventListener("click", () => {
    setMenu(!menu.classList.contains("open"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });
}

const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}
