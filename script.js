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

const deskToggle = document.querySelector(".agent-desk-toggle");
const deskMeta = document.getElementById("agent-desk-meta");
const deskTrace = document.getElementById("agent-trace");

if (deskToggle && deskMeta && deskTrace) {
  deskToggle.addEventListener("click", () => {
    const open = deskTrace.hasAttribute("hidden");
    deskTrace.toggleAttribute("hidden", !open);
    deskToggle.setAttribute("aria-expanded", String(open));
  });

  fetch("agent/last-run.json")
    .then((response) => {
      if (!response.ok) throw new Error("no trace");
      return response.json();
    })
    .then((run) => {
      const when = new Date(run.ran_at);
      const day = Number.isNaN(when.getTime())
        ? "unknown"
        : when.toISOString().slice(0, 10);
      const rows = Array.isArray(run.picks) ? run.picks.length : 0;
      deskMeta.textContent = `${rows} rows from GitHub · ${day}`;
      deskTrace.replaceChildren();
      (run.steps || []).forEach((step) => {
        const item = document.createElement("li");
        const tool = document.createElement("code");
        tool.textContent = String(step.tool || "step");
        const detail = document.createElement("span");
        detail.textContent = String(step.detail || "");
        item.append(tool, detail);
        deskTrace.append(item);
      });
    })
    .catch(() => {
      deskMeta.textContent = "trace missing. run python3 agent/maintainer.py";
    });
}
