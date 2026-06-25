export const SLOT_INTERVAL = 15;
export const DAY_START = 8 * 60;
export const DAY_END = 16 * 60;
export const LUNCH_START = 12 * 60;
export const LUNCH_END = 13 * 60;
export const DAYS_SHOWN = 10;

export function generateSlots() {
  const slots = [];
  let t = DAY_START;
  while (t + 10 <= DAY_END) {
    if (t >= LUNCH_START && t < LUNCH_END) { t += SLOT_INTERVAL; continue; }
    const h = Math.floor(t / 60);
    const m = t % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    slots.push({ time: t, label: hour + ":" + m.toString().padStart(2, "0") + " " + period });
    t += SLOT_INTERVAL;
  }
  return slots;
}
export const DAILY_SLOTS = generateSlots();

export function getDays() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export function formatDate(d) {
  return d.toISOString().split("T")[0];
}

export function formatDayLabel(d, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function isValidEmail(s) {
  const str = String(s).trim();
  const at = str.indexOf("@");
  const dot = str.lastIndexOf(".");
  return at > 0 && dot > at + 1 && dot < str.length - 1;
}

const SHEET_API = import.meta.env.VITE_SHEET_API || "";
const LS_KEY = "goat-bookings-v1";

function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
}
function lsWrite(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) {}
}

export async function loadBookings() {
  if (!SHEET_API) {
    return { bookings: lsRead(), blocked: {} };
  }
  try {
    const url = SHEET_API + "?action=list&t=" + Date.now();
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.ok) return { bookings: {}, blocked: {} };
    const bookings = {};
    const blocked = {};
    for (const r of data.bookings) {
      if (String(r.slotTime) === "BLOCK") { blocked[r.date] = true; continue; }
      if (!bookings[r.date]) bookings[r.date] = {};
      bookings[r.date][r.slotTime] = { name: r.name, email: r.email, notes: r.notes };
    }
    return { bookings: bookings, blocked: blocked };
  } catch (e) {
    return { bookings: {}, blocked: {} };
  }
}

async function postAction(payload) {
  try {
    const res = await fetch(SHEET_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: "network" };
  }
}

export async function bookSlot(opts) {
  if (!SHEET_API) {
    const all = lsRead();
    if (all[opts.date] && all[opts.date][opts.slotTime]) return { ok: false, error: "taken" };
    if (!all[opts.date]) all[opts.date] = {};
    all[opts.date][opts.slotTime] = { name: opts.name, email: opts.email };
    lsWrite(all);
    return { ok: true };
  }
  return postAction({ action: "book", date: opts.date, slotTime: opts.slotTime, slotLabel: opts.slotLabel, name: opts.name, email: opts.email });
}

export async function cancelSlot(opts) {
  if (!SHEET_API) {
    const all = lsRead();
    if (all[opts.date]) {
      delete all[opts.date][opts.slotTime];
      if (!Object.keys(all[opts.date]).length) delete all[opts.date];
    }
    lsWrite(all);
    return { ok: true };
  }
  return postAction({ action: "cancel", date: opts.date, slotTime: opts.slotTime, email: opts.email });
}

export async function adminRemove(opts) {
  if (!SHEET_API) {
    const all = lsRead();
    if (all[opts.date]) {
      delete all[opts.date][opts.slotTime];
      if (!Object.keys(all[opts.date]).length) delete all[opts.date];
    }
    lsWrite(all);
    return { ok: true };
  }
  return postAction({ action: "admincancel", date: opts.date, slotTime: opts.slotTime });
}

export async function setDayBlock(opts) {
  if (!SHEET_API) return { ok: true };
  return postAction({ action: opts.blocked ? "block" : "unblock", date: opts.date });
}
