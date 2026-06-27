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

// --- Database API (Supabase) ---
const SUPABASE_URL = "https://kafxlwboepfekybipzog.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZnhsd2JvZXBmZWt5Ymlwem9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzMwMDMsImV4cCI6MjA5ODE0OTAwM30.RsuH-GXnv63_vRQ6-veg3o8xa_gBYPqu7KbYGAjJeXA";
const LS_KEY = "goat-bookings-v1";

function sbHeaders(extra) {
  return Object.assign({
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
  }, extra || {});
}

function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function lsWrite(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (_) {}
}

export async function loadBookings() {
  try {
    const [bRes, dRes] = await Promise.all([
      fetch(SUPABASE_URL + "/rest/v1/bookings?select=date,time,name,email,notes", { headers: sbHeaders() }),
      fetch(SUPABASE_URL + "/rest/v1/blocked_days?select=date", { headers: sbHeaders() })
    ]);
    const rows = await bRes.json();
    const blockedRows = await dRes.json();
    const bookings = {};
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!bookings[r.date]) bookings[r.date] = {};
      bookings[r.date][r.time] = { name: r.name, email: r.email, notes: r.notes || "" };
    }
    const blocked = {};
    for (const r of (Array.isArray(blockedRows) ? blockedRows : [])) {
      blocked[r.date] = true;
    }
    return { bookings, blocked };
  } catch (e) {
    console.error("loadBookings failed", e);
    return { bookings: lsRead(), blocked: {} };
  }
}

export async function bookSlot(opts) {
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/bookings", {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ date: opts.date, time: opts.slotTime, slot_label: opts.slotLabel, name: opts.name, email: opts.email })
    });
    if (res.status === 409) return { ok: false, error: "taken" };
    if (!res.ok) return { ok: false, error: "network" };
    return { ok: true };
  } catch (e) {
    console.error("bookSlot failed", e);
    return { ok: false, error: "network" };
  }
}

export async function cancelSlot(opts) {
  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/bookings?date=eq." + encodeURIComponent(opts.date) +
      "&time=eq." + encodeURIComponent(opts.slotTime) +
      "&email=eq." + encodeURIComponent(opts.email),
      { method: "DELETE", headers: sbHeaders() }
    );
    if (!res.ok) return { ok: false, error: "network" };
    return { ok: true };
  } catch (e) {
    console.error("cancelSlot failed", e);
    return { ok: false, error: "network" };
  }
}

export async function adminRemove(opts) {
  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/bookings?date=eq." + encodeURIComponent(opts.date) +
      "&time=eq." + encodeURIComponent(opts.slotTime),
      { method: "DELETE", headers: sbHeaders() }
    );
    if (!res.ok) return { ok: false, error: "network" };
    return { ok: true };
  } catch (e) {
    console.error("adminRemove failed", e);
    return { ok: false, error: "network" };
  }
}

export async function setDayBlock(opts) {
  try {
    if (opts.blocked) {
      const res = await fetch(SUPABASE_URL + "/rest/v1/blocked_days", {
        method: "POST",
        headers: sbHeaders({ "Prefer": "return=minimal,resolution=ignore-duplicates" }),
        body: JSON.stringify({ date: opts.date })
      });
      if (!res.ok && res.status !== 409) return { ok: false, error: "network" };
    } else {
      const res = await fetch(
        SUPABASE_URL + "/rest/v1/blocked_days?date=eq." + encodeURIComponent(opts.date),
        { method: "DELETE", headers: sbHeaders() }
      );
      if (!res.ok) return { ok: false, error: "network" };
    }
    return { ok: true };
  } catch (e) {
    console.error("setDayBlock failed", e);
    return { ok: false, error: "network" };
  }
}
