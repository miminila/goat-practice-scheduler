import { useState, useEffect } from "react";
import {
  DAILY_SLOTS, getDays, formatDate, formatDayLabel, isValidEmail, isValidPhone, formatPhone,
  loadBookings, bookSlot, cancelSlot, isSlotAvailable
} from "./utils";

const BOOKING_EMAIL_KEY = import.meta.env.VITE_BOOKING_EMAIL_KEY || "041fdbc9-cf60-4674-a2e4-1ffa01ee0ab7";
async function notifyCoaches({ kind, name, email, phone, day, slot }) {
  if (!BOOKING_EMAIL_KEY) return;
  const subject = kind === "cancellation"
    ? "Goat practice CANCELLED - " + name + ", " + day + " " + slot
    : "New goat practice booking - " + name + ", " + day + " " + slot;
  const message = (kind === "cancellation" ? "A slot was cancelled." : "Someone booked a slot.") +
    "\n\nName: " + name + "\nEmail: " + email + "\nPhone: " + phone + "\nDay: " + day + "\nTime: " + slot;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ access_key: BOOKING_EMAIL_KEY, subject, from_name: "Goat Practice", name, email, phone, day, slot, message, botcheck: "" }),
    });
  } catch (_) {}
}

function buildCalendarLink({ name, dateObj, slotTime, slotLabel }) {
  const start = new Date(dateObj);
  start.setMinutes(start.getMinutes() + slotTime);
  const end = new Date(start); end.setMinutes(end.getMinutes() + 10);
  const z = (n) => String(n).padStart(2, "0");
  const fmt = (d) => d.getUTCFullYear() + z(d.getUTCMonth()+1) + z(d.getUTCDate()) + "T" + z(d.getUTCHours()) + z(d.getUTCMinutes()) + "00Z";
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Goat Practice//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT","UID:goat-" + Date.now() + "@bookgoatpractice.com",
    "DTSTAMP:" + fmt(new Date()),"DTSTART:" + fmt(start),"DTEND:" + fmt(end),
    "SUMMARY:Goat Practice",
    "DESCRIPTION:Your 10-minute goat practice slot at " + slotLabel + ". Booked for " + name + ".",
    "BEGIN:VALARM","TRIGGER:-P1D","ACTION:DISPLAY","DESCRIPTION:Goat practice tomorrow","END:VALARM",
    "BEGIN:VALARM","TRIGGER:-PT1H","ACTION:DISPLAY","DESCRIPTION:Goat practice in 1 hour","END:VALARM",
    "END:VEVENT","END:VCALENDAR",
  ].join("\r\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}

function formatDateKey(dk) {
  const parts = dk.split("-");
  if (parts.length !== 3) return dk;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function BookingView({ mode }) {
  const DAYS = getDays();
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [cancelEmail, setCancelEmail] = useState("");
  const [cancelResult, setCancelResult] = useState(null);

  async function refresh() { setData(await loadBookings()); }
  useEffect(() => { refresh(); }, []);

  if (!data) return <div style={styles.loading}>Loading schedule…</div>;

  const bookings = data.bookings;
  const blocked = data.blocked || {};
  const dayKey = formatDate(DAYS[selectedDay]);
  const dayBookings = bookings[dayKey] || {};
  const dayBlocked = !!blocked[dayKey];
  const dayHours = (data.hours || {})[dayKey] || null;
  const openCount = dayBlocked ? 0 : DAILY_SLOTS.length - Object.keys(dayBookings).length;

  async function confirmBook() {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.replace(/\D/g, "");
    if (!name) { setModal({ type: "error", msg: "Please enter your name." }); return; }
    if (!isValidEmail(email)) { setModal({ type: "error", msg: "Please enter a valid email address." }); return; }
    if (!isValidPhone(phone)) { setModal({ type: "error", msg: "Please enter a valid 10-digit phone number." }); return; }

    const slot = modal.slot;
    setBusy(true);
    const res = await bookSlot({ date: dayKey, slotTime: slot.time, slotLabel: slot.label, name, email, phone });
    setBusy(false);

    if (!res.ok) {
      const msg = res.error === "taken"
        ? "Sorry — someone just grabbed that slot. Please pick another."
        : res.error === "blocked"
        ? "That day is blocked off. Please choose another day."
        : "Something went wrong. Please try again.";
      await refresh();
      setModal({ type: "error", msg });
      return;
    }

    const dayLabel = formatDayLabel(DAYS[selectedDay], selectedDay);
    notifyCoaches({ kind: "new", name, email, phone: formatPhone(phone), day: dayLabel, slot: slot.label });
    const calLink = buildCalendarLink({ name, dateObj: DAYS[selectedDay], slotTime: slot.time, slotLabel: slot.label });
    await refresh();
    setModal({ type: "success", slotLabel: slot.label, dayLabel, calLink });
  }

  async function handleCancelLookup() {
    const email = cancelEmail.trim();
    if (!isValidEmail(email)) { setCancelResult({ error: "Enter the email you used to book." }); return; }
    const fresh = await loadBookings();
    setData(fresh);
    const found = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const [dk, slots] of Object.entries(fresh.bookings)) {
      const parts = dk.split("-");
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (date < today) continue;
      for (const [time, b] of Object.entries(slots)) {
        if (String(b.email).toLowerCase() === email.toLowerCase()) {
          const slot = DAILY_SLOTS.find(s => String(s.time) === String(time));
          found.push({ dk, time, label: slot?.label, dateStr: dk });
        }
      }
    }
    setCancelResult(found.length ? { bookings: found } : { error: "No upcoming bookings found for that email." });
  }

  async function doCancel(dk, time, label) {
    setBusy(true);
    await cancelSlot({ date: dk, slotTime: time, email: cancelEmail.trim() });
    setBusy(false);
    const dayLabel = formatDateKey(dk);
    notifyCoaches({ kind: "cancellation", name: "(student)", email: cancelEmail.trim(), phone: "", day: dayLabel, slot: label });
    await refresh();
    setCancelResult({ success: "Your " + label + " slot on " + dayLabel + " has been cancelled. The spot is now open for others." });
  }

  if (mode === "book") return (
    <div style={styles.body}>
      <div style={styles.dayScroll}>
        {DAYS.map((d, i) => (
          <button key={i} style={{ ...styles.dayBtn, ...(selectedDay === i ? styles.dayBtnActive : {}) }} onClick={() => setSelectedDay(i)}>
            <span style={styles.dayBtnTop}>{formatDayLabel(d, i)}</span>
            <span style={styles.dayBtnSub}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </button>
        ))}
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#4A7C3F" }} /> Open ({openCount})</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#bbb" }} /> Taken</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#e0c97a", border: "1px dashed #b5922a" }} /> Lunch</span>
      </div>

      {dayBlocked ? (
        <div style={styles.blockedBanner}>This day is closed — no practice scheduled. Please pick another day.</div>
      ) : (
        <div style={styles.grid}>
          <div style={styles.lunchBar}>Lunch 12:00–1:00 PM — no slots</div>
          {DAILY_SLOTS.map(slot => {
            const taken = !!dayBookings[slot.time];
            const now = new Date();
            const isPast = selectedDay === 0 && (now.getHours() * 60 + now.getMinutes()) >= slot.time;
            const isOutsideHours = !isSlotAvailable(slot.time, dayHours);
            const unavailable = taken || isPast || isOutsideHours;
            return (
              <button key={slot.time} disabled={unavailable}
                onClick={() => { setForm({ name: "", email: "", phone: "" }); setModal({ type: "confirm", slot }); }}
                style={{ ...styles.slotBtn, ...(unavailable ? styles.slotTaken : styles.slotOpen) }}>
                <span style={styles.slotTime}>{slot.label}</span>
                <span style={styles.slotSub}>{taken ? "Taken" : isPast ? "Past" : isOutsideHours ? "Closed" : "Available - 10 min"}</span>
              </button>
            );
          })}
        </div>
      )}

      {modal && (
        <div style={styles.overlay} onClick={() => !busy && setModal(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            {modal.type === "confirm" && <>
              <h3 style={styles.modalTitle}>Book {modal.slot.label}</h3>
              <p style={styles.modalSub}>{formatDayLabel(DAYS[selectedDay], selectedDay)} · {DAYS[selectedDay].toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
              <p style={styles.modalNote}>10-minute practice slot · arrive ready to go</p>
              <label style={styles.label}>Your name *</label>
              <input style={styles.input} placeholder="First and last name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={styles.label}>Email *</label>
              <input style={styles.input} type="email" placeholder="you@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <label style={styles.label}>Phone number *</label>
              <input style={styles.input} type="tel" placeholder="(760) 555-1234"
                value={formatPhone(form.phone)}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
              <p style={styles.smsNote}>📅 Tap "Add to Calendar" after booking — your phone will remind you the day before and 1 hour before.</p>
              <div style={styles.btnRow}>
                <button style={styles.backBtn} disabled={busy} onClick={() => setModal(null)}>Back</button>
                <button style={styles.confirmBtn} disabled={busy} onClick={confirmBook}>{busy ? "Booking…" : "Confirm Booking"}</button>
              </div>
            </>}
            {modal.type === "success" && <>
              <div style={styles.bigIcon}>✅</div>
              <h3 style={styles.modalTitle}>You're booked!</h3>
              <p style={styles.modalNote}>You've got {modal.slotLabel} on {modal.dayLabel}. Add it to your calendar so your phone reminds you — the day before and an hour before.</p>
              <a href={modal.calLink} download="goat-practice.ics" style={styles.calBtn}>📅 Add to Calendar</a>
              <button style={styles.doneBtn} onClick={() => setModal(null)}>Done</button>
            </>}
            {modal.type === "error" && <>
              <div style={styles.bigIcon}>⚠️</div>
              <h3 style={styles.modalTitle}>Hold on</h3>
              <p style={styles.modalNote}>{modal.msg}</p>
              <button style={styles.confirmBtn} onClick={() => setModal(null)}>OK</button>
            </>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={styles.body}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Find my booking</h2>
        <p style={styles.cardHint}>Enter the email you used when you booked.</p>
        <div style={styles.row}>
          <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} type="email" placeholder="you@email.com"
            value={cancelEmail} onChange={e => setCancelEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCancelLookup()} />
          <button style={styles.lookupBtn} onClick={handleCancelLookup}>Look up</button>
        </div>
        {cancelResult?.error && <p style={styles.errorMsg}>{cancelResult.error}</p>}
        {cancelResult?.success && <p style={styles.successMsg}>{cancelResult.success}</p>}
        {cancelResult?.bookings && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontFamily: "sans-serif", color: "#555" }}>Your upcoming bookings:</p>
            {cancelResult.bookings.map((b, i) => (
              <div key={i} style={styles.cancelCard}>
                <div>
                  <strong>{b.label}</strong>
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#777", fontFamily: "sans-serif" }}>{formatDateKey(b.dk)}</span>
                </div>
                <button style={styles.cancelBtn} disabled={busy} onClick={() => doCancel(b.dk, b.time, b.label)}>Cancel</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  body: { padding: "20px 16px", maxWidth: 560, margin: "0 auto" },
  loading: { padding: 40, textAlign: "center", fontFamily: "sans-serif", color: "#888" },
  dayScroll: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" },
  dayBtn: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 14px", border: "2px solid #C9A96E", borderRadius: 10, background: "white", cursor: "pointer", minWidth: 80, gap: 2 },
  dayBtnActive: { background: "#3B2008", borderColor: "#3B2008", color: "#F5D78E" },
  dayBtnTop: { fontSize: 12, fontWeight: "bold", fontFamily: "sans-serif" },
  dayBtnSub: { fontSize: 11, color: "inherit", fontFamily: "sans-serif", opacity: 0.7 },
  legend: { display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "sans-serif", color: "#555" },
  dot: { display: "inline-block", width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  blockedBanner: { background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 10, padding: 16, fontFamily: "sans-serif", fontSize: 14, color: "#922b21", textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 8 },
  lunchBar: { gridColumn: "1/-1", background: "#EDE0C4", border: "1px dashed #C9A96E", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#7a5c2e", fontFamily: "sans-serif", textAlign: "center" },
  slotBtn: { display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 14px", border: "none", borderRadius: 10, cursor: "pointer" },
  slotOpen: { background: "#4A7C3F", color: "white", boxShadow: "0 2px 6px rgba(74,124,63,0.3)" },
  slotTaken: { background: "#ddd", color: "#999", cursor: "not-allowed" },
  slotTime: { fontFamily: "sans-serif", fontSize: 15, fontWeight: "bold" },
  slotSub: { fontFamily: "sans-serif", fontSize: 11, marginTop: 2, opacity: 0.85 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modalBox: { background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" },
  modalTitle: { margin: "0 0 4px", fontSize: 22, color: "#3B2008" },
  modalSub: { margin: "0 0 4px", fontFamily: "sans-serif", fontSize: 14, color: "#6B3A1F", fontWeight: "bold" },
  modalNote: { margin: "0 0 18px", fontFamily: "sans-serif", fontSize: 13, color: "#555", lineHeight: 1.5 },
  smsNote: { background: "#F5EFE0", borderRadius: 8, padding: "8px 12px", fontFamily: "sans-serif", fontSize: 12, color: "#555", lineHeight: 1.5, margin: "0 0 18px" },
  label: { display: "block", fontFamily: "sans-serif", fontSize: 11, fontWeight: "bold", color: "#777", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 },
  input: { width: "100%", padding: "10px 12px", border: "1.5px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 15, marginBottom: 14, boxSizing: "border-box" },
  btnRow: { display: "flex", gap: 10 },
  backBtn: { flex: 1, padding: "11px 0", background: "#eee", border: "none", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", color: "#555" },
  confirmBtn: { flex: 1, padding: "11px 0", background: "#3B2008", color: "#F5D78E", border: "none", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer", fontWeight: "bold" },
  calBtn: { display: "block", textAlign: "center", padding: "12px 0", background: "#4A7C3F", color: "white", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", textDecoration: "none", marginBottom: 10 },
  doneBtn: { width: "100%", padding: "11px 0", background: "#eee", color: "#555", border: "none", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" },
  bigIcon: { fontSize: 40, textAlign: "center", marginBottom: 12 },
  card: { background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  cardTitle: { margin: "0 0 6px", fontSize: 20, color: "#3B2008" },
  cardHint: { margin: "0 0 16px", fontSize: 13, fontFamily: "sans-serif", color: "#666" },
  row: { display: "flex", gap: 8, marginBottom: 12 },
  lookupBtn: { padding: "10px 18px", background: "#3B2008", color: "#F5D78E", border: "none", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", whiteSpace: "nowrap" },
  errorMsg: { color: "#C0392B", fontFamily: "sans-serif", fontSize: 13, margin: "8px 0 0" },
  successMsg: { color: "#4A7C3F", fontFamily: "sans-serif", fontSize: 13, margin: "8px 0 0", fontWeight: "bold" },
  cancelCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#F5EFE0", borderRadius: 10, marginBottom: 8 },
  cancelBtn: { padding: "6px 14px", background: "#C0392B", color: "white", border: "none", borderRadius: 7, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer" },
};
