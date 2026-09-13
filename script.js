const menuToggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".menu");

function setMenu(open) {
  if (!menuToggle || !menu) return;
  menu.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

const SEARCH =
  "https://api.github.com/search/issues?q=author:gyanu2507+is:pr+is:merged&per_page=12&sort=updated";

function repoFromUrl(url) {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return { owner: parts[0], repo: parts[1], number: parts[3] };
  } catch {
    return { owner: "", repo: "", number: "" };
  }
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

function normalize(payload) {
  const items = Array.isArray(payload.items) ? payload.items : payload.prs || [];
  return items
    .map((item) => {
      const parsed = repoFromUrl(item.html_url || "");
      return {
        title: item.title || "",
        html_url: item.html_url || "",
        repo: parsed.repo,
        when: item.closed_at || item.updated_at || item.created_at,
      };
    })
    .filter((row) => row.html_url && row.repo);
}

async function fetchPrs() {
  try {
    const local = await fetch("/api/prs", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (local.ok) {
      const data = await local.json();
      if (data && (data.items || data.prs)) return data;
    }
  } catch (_) {
    // Local file or missing API route. Talk to GitHub next.
  }
  const remote = await fetch(SEARCH, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!remote.ok) throw new Error(`GitHub ${remote.status}`);
  return remote.json();
}

function renderPrs(rows, source) {
  const list = document.getElementById("oss-list");
  const status = document.getElementById("oss-status");
  if (!list || !status) return;
  list.replaceChildren();
  rows.forEach((row) => {
    const li = document.createElement("li");
    const repo = document.createElement("a");
    repo.className = "oss-repo";
    repo.href = row.html_url;
    repo.target = "_blank";
    repo.rel = "noopener noreferrer";
    repo.textContent = row.repo;
    const title = document.createElement("span");
    title.className = "oss-title";
    title.textContent = row.title;
    const when = document.createElement("time");
    when.className = "oss-when";
    when.dateTime = row.when || "";
    when.textContent = timeAgo(row.when);
    li.append(repo, title, when);
    list.append(li);
  });
  status.classList.add("live");
  const count = typeof source.total_count === "number" ? source.total_count : rows.length;
  status.textContent = `${count} merged · live from GitHub`;
}

function renderOssError() {
  const list = document.getElementById("oss-list");
  const status = document.getElementById("oss-status");
  if (status) {
    status.classList.remove("live");
    status.textContent = "Could not load GitHub right now.";
  }
  if (!list) return;
  list.replaceChildren();
  const li = document.createElement("li");
  const title = document.createElement("span");
  title.className = "oss-title";
  title.textContent = "See the full list on GitHub while this refreshes.";
  li.append(title);
  list.append(li);
}

fetchPrs()
  .then((payload) => {
    const rows = normalize(payload);
    if (!rows.length) throw new Error("empty");
    renderPrs(rows, payload);
  })
  .catch(renderOssError);
