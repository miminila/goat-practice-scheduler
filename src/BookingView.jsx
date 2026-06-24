import { useState, useEffect } from "react";
import {
  DAILY_SLOTS, getDays, formatDate, formatDayLabel, formatPhone,
  loadBookings, saveBookings
} from "./utils";

const TWILIO_WEBHOOK = import.meta.env.VITE_TWILIO_WEBHOOK || "";

async function fireWebhook(payload) {
  if (!TWILIO_WEBHOOK) return;
  try {
    await fetch(TWILIO_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (_) {}
}

export default function BookingView({ mode }) {
  const DAYS = getDays();
  const [bookings, setBookings] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [cancelPhone, setCancelPhone] = useState("");
  const [cancelResult, setCancelResult] = useState(null);

  useEffect(() => { loadBookings().then(setBookings); }, []);

  if (!bookings) return <div style={styles.loading}>Loading schedule…</div>;

  const dayKey = formatDate(DAYS[selectedDay]);
  const dayBookings = bookings[dayKey] || {};
  const openCount = DAILY_SLOTS.length - Object.keys(dayBookings).length;

  // ── BOOK ──
  async function confirmBook() {
    const { slot } = modal;
    const name = form.name.trim();
    const phone = form.phone.replace(/\D/g, "");
    if (!name) { setModal({ type: "error", msg: "Please enter your name." }); return; }
    if (phone.length < 10) { setModal({ type: "error", msg: "Please enter a valid 10-digit phone number." }); return; }

    const existing = Object.entries(dayBookings).find(([, b]) => b.phone === phone);
    if (existing) {
      const existSlot = DAILY_SLOTS.find(s => s.time === parseInt(existing[0]));
      setModal({ type: "error", msg: `You already have a slot at ${existSlot?.label} on this day.` });
      return;
    }

    const updated = {
      ...bookings,
      [dayKey]: { ...dayBookings, [slot.time]: { name, phone, bookedAt: new Date().toISOString() } },
    };
    setBookings(updated);
    await saveBookings(updated);

    const dayLabel = formatDayLabel(DAYS[selectedDay], selectedDay);
    await fireWebhook({
      event: "new_booking",
      name, phone,
      day: dayLabel,
      date: dayKey,
      slot: slot.label,
      slotTime: slot.time,
    });

    setModal({
      type: "success",
      msg: `You're booked for ${slot.label} on ${dayLabel}! Watch for SMS reminders the day before and 1 hour before your slot.`,
    });
  }

  // ── CANCEL LOOKUP ──
  async function handleCancelLookup() {
    const phone = cancelPhone.replace(/\D/g, "");
    if (phone.length < 10) { setCancelResult({ error: "Enter a valid 10-digit phone number." }); return; }
    const found = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const [dk, slots] of Object.entries(bookings)) {
      const date = new Date(dk + "T00:00:00");
      if (date < today) continue;
      for (const [time, b] of Object.entries(slots)) {
        if (b.phone === phone) {
          const slot = DAILY_SLOTS.find(s => s.time === parseInt(time));
          found.push({ dk, time: parseInt(time), label: slot?.label, name: b.name, date });
        }
      }
    }
    setCancelResult(found.length ? { bookings: found } : { error: "No upcoming bookings found for that number." });
  }

  // ── CANCEL BOOKING ──
  async function cancelBooking(dk, time) {
    const b = bookings[dk]?.[time];
    const updated = { ...bookings, [dk]: { ...bookings[dk] } };
    delete updated[dk][time];
    if (!Object.keys(updated[dk]).length) delete updated[dk];
    setBookings(updated);
    await saveBookings(updated);

    const slot = DAILY_SLOTS.find(s => s.time === time);
    const date = new Date(dk + "T00:00:00");
    const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    await fireWebhook({ event: "cancellation", phone: b?.phone, name: b?.name, date: dk, day: dayLabel, slot: slot?.label });

    setCancelResult({ success: `Your ${slot?.label} slot on ${dayLabel} has been cancelled. The spot is now open for others.` });
  }

  // ── BOOK VIEW ──
  if (mode === "book") return (
    <div style={styles.body}>
      {/* Day tabs */}
      <div style={styles.dayScroll}>
        {DAYS.map((d, i) => (
          <button key={i} style={{ ...styles.dayBtn, ...(selectedDay === i ? styles.dayBtnActive : {}) }} onClick={() => setSelectedDay(i)}>
            <span style={styles.dayBtnTop}>{formatDayLabel(d, i)}</span>
            <span style={styles.dayBtnSub}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#4A7C3F" }} /> Open ({openCount})</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#bbb" }} /> Taken ({DAILY_SLOTS.length - openCount})</span>
        <span style={styles.legendItem}><span style={{ ...styles.dot, background: "#e0c97a", border: "1px dashed #b5922a" }} /> Lunch</span>
      </div>

      {/* Slots */}
      <div style={styles.grid}>
        <div style={styles.lunchBar}>🍽 Lunch 12:00–1:00 PM — no slots available</div>
        {DAILY_SLOTS.map(slot => {
          const taken = !!dayBookings[slot.time];
          return (
            <button key={slot.time} disabled={taken} onClick={() => { setForm({ name: "", phone: "" }); setModal({ type: "confirm", slot }); }}
              style={{ ...styles.slotBtn, ...(taken ? styles.slotTaken : styles.slotOpen) }}>
              <span style={styles.slotTime}>{slot.label}</span>
              <span style={styles.slotSub}>{taken ? "Taken" : "Available · 10 min"}</span>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div style={styles.overlay} onClick={() => setModal(null)}>
          <div style={styles.modalBox} onClick={e => e.stopPropagation()}>
            {modal.type === "confirm" && <>
              <h3 style={styles.modalTitle}>Book {modal.slot.label}</h3>
              <p style={styles.modalSub}>{formatDayLabel(DAYS[selectedDay], selectedDay)} · {DAYS[selectedDay].toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
              <p style={styles.modalNote}>10-minute practice slot · arrive ready to go</p>
              <label style={styles.label}>Your name</label>
              <input style={styles.input} placeholder="First and last name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <label style={styles.label}>Phone number <span style={{ color: "#C0392B" }}>*</span></label>
              <input style={styles.input} type="tel" placeholder="(760) 555-1234" value={formatPhone(form.phone)} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
              <p style={styles.smsNote}>📱 You'll get a text reminder the day before and 1 hour before your slot.</p>
              <div style={styles.btnRow}>
                <button style={styles.backBtn} onClick={() => setModal(null)}>Back</button>
                <button style={styles.confirmBtn} onClick={confirmBook}>Confirm Booking</button>
              </div>
            </>}
            {modal.type === "success" && <>
              <div style={styles.bigIcon}>✅</div>
              <h3 style={styles.modalTitle}>You're booked!</h3>
              <p style={styles.modalNote}>{modal.msg}</p>
              <button style={styles.confirmBtn} onClick={() => setModal(null)}>Done</button>
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

  // ── CANCEL VIEW ──
  return (
    <div style={styles.body}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Find my booking</h2>
        <p style={styles.cardHint}>Enter the phone number you used when you booked.</p>
        <div style={styles.row}>
          <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} type="tel" placeholder="(760) 555-1234"
            value={formatPhone(cancelPhone)}
            onChange={e => setCancelPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#777", fontFamily: "sans-serif" }}>
                    {b.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
                <button style={styles.cancelBtn} onClick={() => cancelBooking(b.dk, b.time)}>Cancel</button>
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
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 8 },
  lunchBar: { gridColumn: "1/-1", background: "#EDE0C4", border: "1px dashed #C9A96E", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#7a5c2e", fontFamily: "sans-serif", textAlign: "center" },
  slotBtn: { display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "10px 14px", border: "none", borderRadius: 10, cursor: "pointer", transition: "opacity 0.15s" },
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
