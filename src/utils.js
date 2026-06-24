// ─── SLOT CONFIG ─────────────────────────────────────────────────────────────
export const SLOT_INTERVAL = 15; // 10 min practice + 5 min gap
export const DAY_START = 8 * 60;   // 8:00 AM
export const DAY_END = 16 * 60;    // 4:00 PM
export const LUNCH_START = 12 * 60;
export const LUNCH_END = 13 * 60;
export const DAYS_SHOWN = 10;

// ─── GENERATE DAILY SLOTS ────────────────────────────────────────────────────
export function generateSlots() {
  const slots = [];
  let t = DAY_START;
  while (t + 10 <= DAY_END) {
    if (t >= LUNCH_START && t < LUNCH_END) { t += SLOT_INTERVAL; continue; }
    const h = Math.floor(t / 60);
    const m = t % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const label = `${hour}:${m.toString().padStart(2, "0")} ${period}`;
    slots.push({ time: t, label });
    t += SLOT_INTERVAL;
  }
  return slots;
}

export const DAILY_SLOTS = generateSlots();

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
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

export function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "goat-bookings-v1";

export async function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export async function saveBookings(bookings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch (e) { console.error("Save failed", e); }
}

// bookings shape: { "2026-06-23": { 480: { name, phone, bookedAt } } }
