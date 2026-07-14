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

// Fallback window used only if no practice dates have been set in Coach View yet.
export function defaultDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() + (DAYS_SHOWN - 1));
  return { startDate: formatDate(today), endDate: formatDate(end) };
}

// Builds the list of dates to show, based on the admin-set start/end date.
export function getDaysInRange(startDateStr, endDateStr) {
  const parse = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(startDateStr);
  const end = parse(endDateStr);
  const days = [];
  let cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 60) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  if (days.length === 0) days.push(new Date(start));
  return days;
}

export function formatDate(d) {
  return d.toISOString().split("T")[0];
}

export function formatDayLabel(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dOnly - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function isValidEmail(s) {
  const str = String(s).trim();
  const at = str.indexOf("@");
  const dot = str.lastIndexOf(".");
  return at > 0 && dot > at + 1 && dot < str.length - 1;
}

export function isValidPhone(s) {
  return String(s).replace(/\D/g, "").length >= 10;
}

export function formatPhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6, 10);
}

export function isSlotAvailable(slotTime, hours) {
  if (!hours) {
    const inLunch = slotTime >= LUNCH_START && slotTime < LUNCH_END;
    return !inLunch;
  }
  const lunchBlocked = hours.lunch_blocked !== false;
  if (lunchBlocked && slotTime >= LUNCH_START && slotTime < LUNCH_END) return false;
  const hasMorning = hours.morning_start != null && hours.morning_end != null;
  const hasAfternoon = hours.afternoon_start != null && hours.afternoon_end != null;
  if (!hasMorning && !hasAfternoon) {
    return !(lunchBlocked && slotTime >= LUNCH_START && slotTime < LUNCH_END);
  }
  const inMorning = hasMorning && slotTime >= hours.morning_start && slotTime < hours.morning_end;
  const inAfternoon = hasAfternoon && slotTime >= hours.afternoon_start && slotTime < hours.afternoon_end;
  return inMorning || inAfternoon;
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://kafxlwboepfekybipzog.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZnhsd2JvZXBmZWt5Ymlwem9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NzMwMDMsImV4cCI6MjA5ODE0OTAwM30.RsuH-GXnv63_vRQ6-veg3o8xa_gBYPqu7KbYGAjJeXA";

async function supa(path, opts) {
  const res = await fetch(SUPA_URL + "/rest/v1/" + path, {
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": "Bearer " + SUPA_KEY,
      "Content-Type": "application/json",
      "Prefer": opts && opts.prefer ? opts.prefer : "return=representation",
    },
    ...opts,
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export async function loadBookings() {
  try {
    const [rows, blocked, hours, settingsRows] = await Promise.all([
      supa("goat_bookings?select=date,slot_time,slot_label,name,email,phone,notes&order=date,slot_time"),
      supa("goat_blocked_days?select=date"),
      supa("goat_day_hours?select=date,morning_start,morning_end,afternoon_start,afternoon_end,lunch_blocked"),
      supa("goat_settings?select=start_date,end_date&limit=1"),
    ]);
    const bookings = {};
    for (const r of rows) {
      if (!bookings[r.date]) bookings[r.date] = {};
      bookings[r.date][r.slot_time] = { name: r.name, email: r.email, phone: r.phone, notes: r.notes };
    }
    const blockedMap = {};
    for (const b of blocked) blockedMap[b.date] = true;
    const hoursMap = {};
    for (const h of hours) hoursMap[h.date] = h;
    const settings = (settingsRows && settingsRows.length && settingsRows[0].start_date && settingsRows[0].end_date)
      ? { startDate: settingsRows[0].start_date, endDate: settingsRows[0].end_date }
      : defaultDateRange();
    return { bookings, blocked: blockedMap, hours: hoursMap, settings };
  } catch (e) {
    console.error("loadBookings failed", e);
    return { bookings: {}, blocked: {}, hours: {}, settings: defaultDateRange() };
  }
}

export async function saveSettings(startDate, endDate) {
  try {
    await supa("goat_settings", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({ id: 1, start_date: startDate, end_date: endDate }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function bookSlot(opts) {
  try {
    await supa("goat_bookings", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({ date: opts.date, slot_time: opts.slotTime, slot_label: opts.slotLabel, name: opts.name, email: opts.email, phone: opts.phone }),
    });
    return { ok: true };
  } catch (e) {
    if (String(e).includes("duplicate") || String(e).includes("unique")) return { ok: false, error: "taken" };
    return { ok: false, error: String(e) };
  }
}

export async function cancelSlot(opts) {
  try {
    await supa("goat_bookings?date=eq." + opts.date + "&slot_time=eq." + opts.slotTime + "&email=eq." + encodeURIComponent(opts.email), { method: "DELETE", prefer: "return=minimal" });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function adminRemove(opts) {
  try {
    await supa("goat_bookings?date=eq." + opts.date + "&slot_time=eq." + opts.slotTime, { method: "DELETE", prefer: "return=minimal" });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function setDayBlock(opts) {
  try {
    if (opts.blocked) {
      await supa("goat_blocked_days", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ date: opts.date }) });
    } else {
      await supa("goat_blocked_days?date=eq." + opts.date, { method: "DELETE", prefer: "return=minimal" });
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function saveDayHours(date, hours) {
  try {
    await supa("goat_day_hours", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({ date, ...hours }),
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function clearDayHours(date) {
  try {
    await supa("goat_day_hours?date=eq." + date, { method: "DELETE", prefer: "return=minimal" });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export function makeTimeOptions() {
  const opts = [];
  for (let t = DAY_START; t <= DAY_END; t += SLOT_INTERVAL) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    opts.push({ value: t, label: hour + ":" + m.toString().padStart(2, "0") + " " + period });
  }
  return opts;
}
