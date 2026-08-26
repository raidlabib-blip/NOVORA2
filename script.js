const firebaseConfig = {
  apiKey: "AIzaSyC2r8VT-WfM39FLmwuqGXXedVSY27BxwUI",
  authDomain: "novora-2bf89.firebaseapp.com",
  databaseURL: "https://novora-2bf89-default-rtdb.firebaseio.com",
  projectId: "novora-2bf89",
  storageBucket: "novora-2bf89.firebasestorage.app",
  messagingSenderId: "910180838274",
  appId: "1:910180838274:web:73501747668dd6cca37d9b",
  measurementId: "G-BQTYBMF4XQ"
};

// Initialize Firebase & Realtime Database
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = typeof firebase.database === "function" ? firebase.database() : null;

const STORAGE_KEYS = {
  hw: "novora_hw_v1",
  settings: "novora_settings_v1",
  week: "novora_week_v1",
  today: "novora_today_v1",
  schedule: "novora_schedule_v1",
  notifierFlag: "novora_notif_flag_v1"
};

const $ = (id) => document.getElementById(id);

const state = {
  currentUser: null,
  hw: [],
  settings: {
    motivationMode: "soft",
    notifMode: "browser",
    dailyNotifTime: "",
    notificationsEnabled: false
  },
  week: { goal: "", days: "" },
  today: { focus: "", done: "no", energy: "medium", energyPlan: [] },
  schedule: { horizonDays: 7, preference: "dueFirst", items: [] }
};

const slogans = {
  soft: [
    "You don’t need more time—you need a clearer plan.",
    "One task done today is momentum for tomorrow.",
    "Keep going. Small steps, big results."
  ],
  hype: [
    "Let’s lock in. Your future self is watching 👀",
    "Today’s focus = tomorrow’s freedom. ⚡",
    "No distractions. Only progress."
  ],
  calm: [
    "Breathe. Focus. Finish the next step.",
    "Slow progress is still progress.",
    "Clarity beats chaos."
  ]
};

function translateFirebaseError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "Email address is already in use.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    default:
      return "An unexpected error occurred. Please try again later.";
  }
}

function setupFirebaseAuth() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      state.currentUser = user;
      if ($("userStatus")) $("userStatus").textContent = user.email;
      if ($("btnLogout")) $("btnLogout").style.display = "inline-flex";
      if ($("authSection")) $("authSection").style.display = "none";
      if ($("mainContent")) $("mainContent").style.display = "block";
      loadAll();
    } else {
      state.currentUser = null;
      if ($("userStatus")) $("userStatus").textContent = "Not logged in";
      if ($("btnLogout")) $("btnLogout").style.display = "none";
      if ($("authSection")) $("authSection").style.display = "block";
      if ($("mainContent")) $("mainContent").style.display = "none";
    }
  });

  $("btnLogin")?.addEventListener("click", async () => {
    const email = $("authEmail")?.value.trim();
    const pass = $("authPassword")?.value;
    if (!email || !pass) return toast("Please enter email and password", "danger");
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      toast("🔓 Logged in successfully!");
    } catch (err) {
      toast("Error: " + translateFirebaseError(err.code), "danger");
    }
  });

  $("btnSignup")?.addEventListener("click", async () => {
    const email = $("authEmail")?.value.trim();
    const pass = $("authPassword")?.value;
    if (!email || !pass) return toast("Please enter email and password", "danger");
    if (pass.length < 6) return toast("Password must be at least 6 characters", "danger");
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      toast("👤 Account created successfully!");
    } catch (err) {
      toast("Error: " + translateFirebaseError(err.code), "danger");
    }
  });

  $("btnLogout")?.addEventListener("click", async () => {
    try {
      await auth.signOut();
      toast("🔒 Logged out!");
    } catch (err) {
      toast("Error logging out", "danger");
    }
  });
}

function syncHomeworkToFirebase() {
  if (!state.currentUser || !db) return;
  db.ref("users/" + state.currentUser.uid + "/hw").set(state.hw).catch(err => {
    console.error("Firebase sync error:", err);
  });
}

async function fetchHomeworkFromFirebase() {
  if (!state.currentUser || !db) return [];
  try {
    const snapshot = await db.ref("users/" + state.currentUser.uid + "/hw").once("value");
    if (snapshot.exists()) {
      return snapshot.val() || [];
    }
  } catch (err) {
    console.error("Firebase fetch error:", err);
  }
  return [];
}

function toast(msg, tone = "ok") {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.style.borderColor = tone === "danger" ? "rgba(255,77,109,.35)" : "rgba(34,230,168,.28)";
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function formatDue(dateStr) {
  if (!dateStr) return "No due date";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function energyClass(energy) {
  if (energy === "low") return "energyLow";
  if (energy === "high") return "energyHigh";
  return "energyMedium";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00").getTime();
  const now = new Date().setHours(0,0,0,0);
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function sanitizeText(s) {
  return (s || "").toString().trim();
}

function getAllSubjects() {
  const set = new Set(state.hw.map(h => h.subject).filter(Boolean));
  return Array.from(set).sort();
}

function refreshSubjectFilter() {
  const sel = $("hwFilter");
  if (!sel) return;
  const current = sel.value;
  const subjects = getAllSubjects();

  sel.innerHTML = `<option value="All" selected>All Subjects</option>`;
  for (const sub of subjects) {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    sel.appendChild(opt);
  }
  if (subjects.includes(current)) sel.value = current;
}

function isActive(hw) {
  return hw.done !== true;
}

function applyFilterAndRender() {
  const selFilter = $("hwFilter");
  const selShow = $("hwShow");
  if (!selFilter || !selShow) return;

  const filter = selFilter.value;
  const show = selShow.value;

  let list = state.hw.slice();

  if (filter !== "All") list = list.filter(h => h.subject === filter);
  if (show === "active") list = list.filter(isActive);
  if (show === "done") list = list.filter(h => h.done === true);

  list.sort((a,b) => {
    const da = a.dueDate ? new Date(a.dueDate + "T00:00:00").getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate + "T00:00:00").getTime() : Infinity;
    if (da !== db) return da - db;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const root = $("hwList");
  if (!root) return;
  root.innerHTML = "";

  if (list.length === 0) {
    root.innerHTML = `<div class="item"><div class="itemTitle">No items found.</div><div class="meta">Add homework to start planning.</div></div>`;
    return;
  }

  for (const hw of list) {
    const item = document.createElement("div");
    item.className = "item";

    const due = daysUntil(hw.dueDate);
    const dueLabel = due === null ? "No due date" : due < 0 ? `Overdue (${Math.abs(due)}d)` : due === 0 ? "Due today" : `Due in ${due}d`;

    item.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(hw.title || "Untitled")}</div>
          <div class="meta">
            <span class="chip">📌 ${escapeHtml(hw.subject || "Other")}</span>
            <span class="chip ${energyClass(hw.energy)}">⚡ Energy: ${escapeHtml(hw.energy || "medium")}</span>
            <span>⏰ ${escapeHtml(dueLabel)}</span>
          </div>
          ${hw.notes ? `<div class="meta">📝 ${escapeHtml(hw.notes)}</div>` : ``}
          ${hw.attachmentDataUrl ? `
            <div class="thumb">
              <img alt="attachment" src="${hw.attachmentDataUrl}" />
              <div class="thumbHint">📎 Attachment saved.</div>
            </div>
          ` : ``}
        </div>

        <div class="itemActions">
          <button class="iconBtn ${hw.done ? "" : "done"}" data-action="toggleDone" data-id="${hw.id}">
            ${hw.done ? "↩️ Reopen" : "✅ Done"}
          </button>
          <button class="iconBtn" data-action="remindNow" data-id="${hw.id}" title="In-app reminder now">
            ⏱️ Remind
          </button>
          <button class="iconBtn danger" data-action="delete" data-id="${hw.id}">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;

    root.appendChild(item);
  }
}

function updateStats() {
  const total = state.hw.length;
  const done = state.hw.filter(x => x.done === true).length;
  const dueSoon = state.hw.filter(x => {
    if (x.done === true) return false;
    const d = daysUntil(x.dueDate);
    return d !== null && d <= 2;
  }).length;

  if ($("statTotal")) $("statTotal").textContent = total;
  if ($("statDone")) $("statDone").textContent = done;
  if ($("statDueSoon")) $("statDueSoon").textContent = dueSoon;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m]));
}

function pickEnergyMatch(hwEnergy, todayEnergy) {
  const map = { low: 0, medium: 1, high: 2 };
  const a = map[hwEnergy] ?? 1;
  const b = map[todayEnergy] ?? 1;
  return Math.max(0, 2 - Math.abs(a - b));
}

function scoreHomework(hw, todayEnergy, preference) {
  const d = daysUntil(hw.dueDate);
  const dueScore = d === null ? 1 : (d < 0 ? 6 : d === 0 ? 5 : d <= 3 ? 4 : d <= 7 ? 2 : 1);
  const energyScore = pickEnergyMatch(hw.energy, todayEnergy) + 1;

  if (preference === "dueFirst") return dueScore * 3 + energyScore;
  if (preference === "energyFirst") return energyScore * 3 + dueScore;
  return dueScore * 2 + energyScore * 2;
}

function renderTodayPlan() {
  const list = $("todayPlan");
  if (!list) return;
  list.innerHTML = "";

  const today = state.today;
  if (!today.energyPlan || today.energyPlan.length === 0) {
    if ($("todaySummary")) $("todaySummary").innerHTML = `Add homework, then generate a plan with your available <b>energy</b>.`;
    return;
  }

  if ($("todaySummary")) {
    $("todaySummary").innerHTML = `
      You have <b>${escapeHtml(today.energy)}</b> energy today.
      Plan generated from <b>${today.energyPlan.length}</b> tasks.
    `;
  }

  for (const task of today.energyPlan) {
    const el = document.createElement("div");
    el.className = "item";
    const due = daysUntil(task.dueDate);
    el.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${escapeHtml(task.title)}</div>
          <div class="meta">
            <span class="chip">📌 ${escapeHtml(task.subject)}</span>
            <span class="chip ${energyClass(task.energy)}">⚡ ${escapeHtml(task.energy)}</span>
            <span>⏰ ${escapeHtml(due === null ? "No due date" : due < 0 ? `Overdue (${Math.abs(due)}d)` : due === 0 ? "Due today" : `Due in ${due}d`)}</span>
          </div>
          ${task.notes ? `<div class="meta">📝 ${escapeHtml(task.notes)}</div>` : ``}
        </div>
        <div class="itemActions">
          <button class="iconBtn done" data-action="markDoneFromPlan" data-id="${task.id}">✅ Mark Done</button>
        </div>
      </div>
    `;
    list.appendChild(el);
  }
}

function generateTodayPlan() {
  const energy = $("todayEnergy") ? $("todayEnergy").value : "medium";
  state.today.energy = energy;

  const active = state.hw.filter(isActive);

  const scored = active
    .map(hw => ({ hw, score: scoreHomework(hw, energy, "balanced") }))
    .sort((a,b) => b.score - a.score);

  const top = scored.slice(0, 5).map(x => x.hw);
  state.today.energyPlan = top;

  saveJSON(STORAGE_KEYS.today, state.today);
  renderTodayPlan();
  applyFilterAndRender();
  updateStats();

  toast("⚡ Today plan generated!");
}

function buildSchedule() {
  const horizonDays = Math.max(1, Math.min(14, Number($("horizonDays")?.value || 7)));
  const preference = $("schedulePreference")?.value || "dueFirst";

  state.schedule.horizonDays = horizonDays;
  state.schedule.preference = preference;

  const start = new Date();
  start.setHours(0,0,0,0);

  const active = state.hw.filter(isActive);
  const plan = [];
  const pool = active.slice();

  for (let i = 0; i < horizonDays; i++) {
    const dayDate = new Date(start.getTime() + i*24*60*60*1000);
    const dayStr = dayDate.toISOString().slice(0,10);

    const todayEnergy = state.today.energy || "medium";
    const cycle = ["low", "medium", "high"];
    const idx = cycle.indexOf(todayEnergy);
    const energyForDay = cycle[(idx + i) % cycle.length];

    const candidates = pool
      .map(hw => ({ hw, score: scoreHomework(hw, energyForDay, preference) }))
      .sort((a,b) => b.score - a.score);

    const chosen = candidates.slice(0, 3).map(x => x.hw);

    for (const c of chosen) {
      const index = pool.findIndex(p => p.id === c.id);
      if (index >= 0) pool.splice(index, 1);
    }

    plan.push({ date: dayStr, energy: energyForDay, tasks: chosen });
  }

  state.schedule.items = plan;
  saveJSON(STORAGE_KEYS.schedule, state.schedule);
  renderSchedule();
  toast("🧠 Schedule built!");
}

function renderSchedule() {
  const out = $("scheduleOutput");
  const list = $("scheduleList");
  if (!list || !out) return;
  list.innerHTML = "";

  const items = state.schedule.items || [];
  if (!items.length) {
    out.textContent = "Build a schedule to see your study plan.";
    return;
  }

  out.innerHTML = `Horizon: <b>${escapeHtml(String(state.schedule.horizonDays))}</b> days • Preference: <b>${escapeHtml(state.schedule.preference)}</b>`;

  for (const day of items) {
    const count = day.tasks.length;
    const card = document.createElement("div");
    card.className = "item";
    card.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">📅 ${formatDue(day.date)}</div>
          <div class="meta">
            <span class="chip ${energyClass(day.energy)}">⚡ Energy: ${escapeHtml(day.energy)}</span>
            <span>✅ Tasks planned: ${count}</span>
          </div>
          ${count ? "" : `<div class="meta">No tasks remaining for this day.</div>`}
        </div>
      </div>
      ${count ? day.tasks.map(t => `
        <div class="meta" style="margin-top:8px">
          • ${escapeHtml(t.title)} <span style="opacity:.75">(${escapeHtml(t.subject)})</span>
        </div>
      `).join("") : ""}
    `;
    list.appendChild(card);
  }
}

function requestBrowserNotifPermission() {
  if (!("Notification" in window)) {
    toast("Notifications are not supported in this browser", "danger");
    return;
  }
  Notification.requestPermission().then(p => {
    const enabled = p === "granted";
    state.settings.notificationsEnabled = enabled;
    saveJSON(STORAGE_KEYS.settings, state.settings);
    localStorage.setItem(STORAGE_KEYS.notifierFlag, JSON.stringify({ enabled }));
    if (enabled) toast("🔔 Notifications enabled successfully!");
    else toast("🔔 Notification permission denied.", "danger");
  });
}

function showNotification(title, body) {
  toast(`🔔 ${title}: ${body}`);
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch (err) {
      console.log("Could not trigger browser notification:", err);
    }
  }
}

function scheduleInAppDailyReminder() {
  if (!state.settings.dailyNotifTime) return;

  const [hh, mm] = state.settings.dailyNotifTime.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;

  const key = "novora_daily_last_sent_v1";
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === hh && now.getMinutes() === mm) {
      const today = now.toISOString().slice(0,10);
      const last = localStorage.getItem(key);
      if (last !== today) {
        localStorage.setItem(key, today);
        showNotification("NOVORA — Daily Check-in", sanitizeText(state.today.focus) ? state.today.focus : "Pick one task and start now.");
      }
    }
  }, 15000);
}

async function fileToDataURL(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

async function addHomework() {
  const subject = $("hwSubject")?.value || "General";
  const energy = $("hwEnergy")?.value || "medium";
  const title = sanitizeText($("hwTitle")?.value);
  const dueDate = $("hwDue")?.value || null;
  const notes = sanitizeText($("hwNotes")?.value);
  const reminderMinRaw = $("hwReminderMin")?.value;
  const reminderMin = reminderMinRaw === "" || !reminderMinRaw ? null : Math.max(0, Number(reminderMinRaw));

  const fileInput = $("hwFile");
  const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

  if (!title) {
    toast("Please enter a homework title.", "danger");
    return;
  }

  if (file && file.size > 2 * 1024 * 1024) {
    toast("Image size is too large, choose an image under 2MB.", "danger");
    return;
  }

  let attachmentDataUrl = null;
  if (file) {
    try {
      attachmentDataUrl = await fileToDataURL(file);
    } catch {
      toast("Failed to read attached file.", "danger");
      return;
    }
  }

  const hw = {
    id: uid(),
    createdAt: Date.now(),
    subject,
    energy,
    title,
    dueDate,
    notes,
    reminderMin,
    done: false,
    attachmentDataUrl
  };

  state.hw.push(hw);
  saveJSON(STORAGE_KEYS.hw, state.hw);
  syncHomeworkToFirebase();

  refreshSubjectFilter();
  applyFilterAndRender();
  updateStats();
  persistReminder(hw);

  if ($("hwTitle")) $("hwTitle").value = "";
  if ($("hwNotes")) $("hwNotes").value = "";
  if ($("hwReminderMin")) $("hwReminderMin").value = "";
  if ($("hwDue")) $("hwDue").value = "";
  if ($("hwFile")) $("hwFile").value = "";

  toast("✅ Homework added successfully!");
}

function persistReminder(hw) {
  const remKey = "novora_reminders_v1";
  const list = loadJSON(remKey, []);
  const filtered = list.filter(x => x.hwId !== hw.id);

  if (!hw.dueDate || hw.reminderMin === null || hw.reminderMin === undefined) {
    saveJSON(remKey, filtered);
    return;
  }

  const due = new Date(hw.dueDate + "T00:00:00");
  const trigger = new Date(due.getTime() - hw.reminderMin * 60 * 1000);

  filtered.push({
    hwId: hw.id,
    triggerMs: trigger.getTime(),
    dueDate: hw.dueDate,
    createdAt: Date.now(),
    sent: false
  });

  saveJSON(remKey, filtered);
}

function reminderPolling() {
  const remKey = "novora_reminders_v1";
  setInterval(() => {
    const list = loadJSON(remKey, []);
    const now = Date.now();

    let changed = false;
    for (const r of list) {
      if (r.sent) continue;
      if (r.triggerMs <= now) {
        const hw = state.hw.find(x => x.id === r.hwId);
        if (!hw || hw.done === true) {
          r.sent = true;
          changed = true;
          continue;
        }
        showNotification("NOVORA — Homework Reminder", `${hw.title} (${hw.subject})`);
        r.sent = true;
        changed = true;
      }
    }

    if (changed) saveJSON(remKey, list);
  }, 15000);
}

function updateSlogan() {
  const mode = state.settings.motivationMode || "soft";
  const arr = slogans[mode] || slogans.soft;
  const pick = arr[Math.floor(Math.random() * arr.length)];
  if ($("sloganText")) $("sloganText").textContent = pick;
}

function saveSettings() {
  if ($("motivationMode")) state.settings.motivationMode = $("motivationMode").value;
  if ($("notifMode")) state.settings.notifMode = $("notifMode").value;
  if ($("dailyNotifTime")) state.settings.dailyNotifTime = $("dailyNotifTime").value;

  saveJSON(STORAGE_KEYS.settings, state.settings);
  toast("💾 Settings saved!");

  if (!window.__novoraDailyScheduled) {
    window.__novoraDailyScheduled = true;
    scheduleInAppDailyReminder();
  }
}

async function loadAll() {
  const remoteHw = await fetchHomeworkFromFirebase();
  if (remoteHw && remoteHw.length > 0) {
    state.hw = remoteHw;
    saveJSON(STORAGE_KEYS.hw, state.hw);
  } else {
    state.hw = loadJSON(STORAGE_KEYS.hw, []);
  }

  state.settings = { ...state.settings, ...loadJSON(STORAGE_KEYS.settings, state.settings) };
  state.week = loadJSON(STORAGE_KEYS.week, state.week);
  state.today = loadJSON(STORAGE_KEYS.today, state.today);
  state.schedule = loadJSON(STORAGE_KEYS.schedule, state.schedule);

  const nf = loadJSON(STORAGE_KEYS.notifierFlag, { enabled: false });
  if (typeof nf.enabled === "boolean") state.settings.notificationsEnabled = nf.enabled;

  if ($("motivationMode")) $("motivationMode").value = state.settings.motivationMode;
  if ($("notifMode")) $("notifMode").value = state.settings.notifMode;
  if ($("dailyNotifTime")) $("dailyNotifTime").value = state.settings.dailyNotifTime || "";

  if ($("todayFocus")) $("todayFocus").value = state.today.focus || "";
  if ($("todayDone")) $("todayDone").value = state.today.done || "no";
  if ($("todayEnergy")) $("todayEnergy").value = state.today.energy || "medium";

  if ($("weekGoal")) $("weekGoal").value = state.week.goal || "";
  if ($("weekDays")) $("weekDays").value = state.week.days || "";

  updateSlogan();
  refreshSubjectFilter();
  applyFilterAndRender();
  updateStats();
  renderTodayPlan();
  renderWeeklyPreview();
  renderSchedule();

  reminderPolling();
}

function renderWeeklyPreview() {
  const goal = $("weekGoal") ? sanitizeText($("weekGoal").value) : "";
  const days = $("weekDays") ? sanitizeText($("weekDays").value) : "";
  if ($("weekPreview")) {
    $("weekPreview").innerHTML = goal
      ? `Goal: <b>${escapeHtml(goal)}</b><br/>Work days: <b>${escapeHtml(days || "Any")}</b>`
      : `Set a weekly goal and routine to see your preview.`;
  }
}

function saveWeek() {
  state.week.goal = sanitizeText($("weekGoal")?.value);
  state.week.days = sanitizeText($("weekDays")?.value);
  saveJSON(STORAGE_KEYS.week, state.week);
  renderWeeklyPreview();
  toast("📅 Weekly routine saved!");
}

function loadWeekToUI() {
  if ($("weekGoal")) $("weekGoal").value = state.week.goal || "";
  if ($("weekDays")) $("weekDays").value = state.week.days || "";
  renderWeeklyPreview();
  toast("📥 Loaded weekly routine!");
}

function clearAll() {
  if (!confirm("Reset NOVORA? This clears all local and cloud data.")) return;
  
  state.hw = [];
  saveJSON(STORAGE_KEYS.hw, state.hw);
  syncHomeworkToFirebase();

  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem("novora_reminders_v1");
  localStorage.removeItem("novora_daily_last_sent_v1");
  state.settings.notificationsEnabled = false;
  state.today.energyPlan = [];
  state.schedule.items = [];
  location.reload();
}

function handleHomeworkAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");

  const hw = state.hw.find(x => x.id === id);
  if (!hw) return;

  if (action === "toggleDone") {
    hw.done = !hw.done;
    saveJSON(STORAGE_KEYS.hw, state.hw);
    syncHomeworkToFirebase();
    persistReminder(hw);
    applyFilterAndRender();
    updateStats();
    renderTodayPlan();
    renderSchedule();
    toast(hw.done ? "🎉 Marked as done!" : "↩️ Task reopened.");
  }

  if (action === "delete") {
    if (!confirm("Delete this homework item?")) return;
    state.hw = state.hw.filter(x => x.id !== id);
    saveJSON(STORAGE_KEYS.hw, state.hw);
    syncHomeworkToFirebase();
    applyFilterAndRender();
    refreshSubjectFilter();
    updateStats();
    renderTodayPlan();
    renderSchedule();
    toast("🗑️ Deleted.");
  }

  if (action === "remindNow") {
    if (hw.done) {
      toast("This task is already completed.");
      return;
    }
    showNotification("NOVORA — Reminder", `${hw.title} (${hw.subject})`);
  }

  if (action === "markDoneFromPlan") {
    hw.done = true;
    saveJSON(STORAGE_KEYS.hw, state.hw);
    syncHomeworkToFirebase();
    applyFilterAndRender();
    updateStats();
    generateTodayPlan();
    renderSchedule();
    toast("✅ Nice. Keep the streak!");
  }
}

function initTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tabPane").forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const key = tab.getAttribute("data-tab");
      if ($(key)) $(key).classList.add("active");
    });
  });
}

function sortHomework() {
  applyFilterAndRender();
  toast("⏳ Sorted by due date.");
}

function initEvents() {
  $("btnAddHw")?.addEventListener("click", addHomework);
  $("btnSort")?.addEventListener("click", sortHomework);

  $("hwFilter")?.addEventListener("change", applyFilterAndRender);
  $("hwShow")?.addEventListener("change", applyFilterAndRender);

  $("hwList")?.addEventListener("click", handleHomeworkAction);
  $("todayPlan")?.addEventListener("click", handleHomeworkAction);

  $("btnGenerate")?.addEventListener("click", () => {
    if ($("todayFocus")) state.today.focus = sanitizeText($("todayFocus").value);
    if ($("todayDone")) state.today.done = $("todayDone").value;
    if ($("todayEnergy")) state.today.energy = $("todayEnergy").value;

    saveJSON(STORAGE_KEYS.today, state.today);
    generateTodayPlan();
  });

  $("btnSaveWeek")?.addEventListener("click", saveWeek);
  $("btnLoadWeek")?.addEventListener("click", loadWeekToUI);

  $("btnBuildSchedule")?.addEventListener("click", buildSchedule);
  $("btnClearSchedule")?.addEventListener("click", () => {
    state.schedule.items = [];
    saveJSON(STORAGE_KEYS.schedule, state.schedule);
    renderSchedule();
    toast("🧹 Schedule cleared.");
  });

  $("btnSaveSettings")?.addEventListener("click", saveSettings);
  $("btnRequestNotif")?.addEventListener("click", requestBrowserNotifPermission);

  $("btnTestNotif")?.addEventListener("click", () => {
    showNotification("NOVORA — Test Reminder", "You should see this toast/notification.");
  });

  $("btnResetAll")?.addEventListener("click", clearAll);

  $("weekGoal")?.addEventListener("input", renderWeeklyPreview);
  $("weekDays")?.addEventListener("input", renderWeeklyPreview);
}

(function boot() {
  setupFirebaseAuth();
  initTabs();
  initEvents();
  renderWeeklyPreview();

  if ("Notification" in window && Notification.permission === "granted") {
    state.settings.notificationsEnabled = true;
    saveJSON(STORAGE_KEYS.settings, state.settings);
    localStorage.setItem(STORAGE_KEYS.notifierFlag, JSON.stringify({ enabled: true }));
  }

  toast("✨ NOVORA is ready.");
})();