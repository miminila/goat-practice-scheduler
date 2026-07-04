
AdminView.jsx

Page
1
/
1
100%
import { useState, useEffect } from "react";
import { DAILY_SLOTS, getDays, formatDate, formatDayLabel, loadBookings, adminRemove, setDayBlock } from "./utils";

export default function AdminView() {
  const DAYS = getDays();
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  async function refresh() { setData(await loadBookings()); }
  useEffect(() => { refresh(); }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  if (!data) return <div style={styles.loading}>Loading...</div>;

  const bookings = data.bookings;
  const blocked = data.blocked || {};
  const dayKey = formatDate(DAYS[selectedDay]);
  const dayBookings = bookings[dayKey] || {};
  const isBlocked = !!blocked[dayKey];
  const bookedCount = Object.keys(dayBookings).length;
  const openCount = isBlocked ? 0 : DAILY_SLOTS.length - bookedCount;

  async function toggleBlock() {
    setBusy(true);
    await setDayBlock({ date: dayKey, blocked: !isBlocked });
    await refresh();
    setBusy(false);
    showToast(isBlocked ? "Day reopened - slots are bookable again." : "Day blocked - no new bookings allowed.");
  }

  async function removeBooking(time, name, label) {
    if (!window.confirm("Remove " + name + "'s booking at " + label + "?")) return;
    setBusy(true);
    await adminRemove({ date: dayKey, slotTime: time });
    await refresh();
    setBusy(false);
    showToast(name + "'s slot removed.");
  }

  const roster = DAILY_SLOTS.map(slot => ({ slot, booking: dayBookings[slot.time] || null }));
  const totalBooked = DAYS.reduce((sum, d) => sum + Object.keys(bookings[formatDate(d)] || {}).length, 0);

  return (
    <div style={styles.body}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{totalBooked}</span><span style={styles.summaryLabel}>Booked - 10 days</span></div>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{bookedCount}</span><span style={styles.summaryLabel}>Booked this day</span></div>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{openCount}</span><span style={styles.summaryLabel}>Open this day</span></div>
      </div>

      <div style={styles.dayScroll}>
        {DAYS.map((d, i) => {
          const dk = formatDate(d);
          const count = Object.keys(bookings[dk] || {}).length;
          const blk = blocked[dk];
          return (
            <button key={i} style={{ ...styles.dayBtn, ...(selectedDay === i ? styles.dayBtnActive : {}), ...(blk ? styles.dayBtnBlocked : {}) }} onClick={() => setSelectedDay(i)}>
              <span style={styles.dayBtnTop}>{formatDayLabel(d, i)}</span>
              <span style={styles.dayBtnSub}>{blk ? "BLOCKED" : count + "/" + DAILY_SLOTS.length}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.dayHeader}>
        <div>
          <h2 style={styles.dayTitle}>{formatDayLabel(DAYS[selectedDay], selectedDay)}</h2>
          <p style={styles.daySubtitle}>{DAYS[selectedDay].toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.refreshBtn} disabled={busy} onClick={refresh}>Refresh</button>
          <button style={{ ...styles.blockBtn, ...(isBlocked ? styles.unblockBtn : {}) }} disabled={busy} onClick={toggleBlock}>
            {isBlocked ? "Unblock Day" : "Block Day"}
          </button>
        </div>
      </div>

      {isBlocked && <div style={styles.blockedBanner}>This day is blocked - students cannot book. Click Unblock Day to reopen.</div>}

      <div style={styles.rosterWrap}>
        <div style={styles.rosterHeader}>
          <span style={styles.colTime}>Time</span>
          <span style={styles.colName}>Student</span>
          <span style={styles.colPhone}>Phone</span>
          <span style={styles.colEmail}>Email</span>
          <span style={styles.colNotes}>Notes</span>
          <span style={styles.colAct}></span>
        </div>
        {roster.map(({ slot, booking }) => (
          <div key={slot.time} style={{ ...styles.rosterRow, background: booking ? "#fff" : "#f9f6f0" }}>
            <span style={styles.colTime}><strong>{slot.label}</strong></span>
            <span style={styles.colName}>{booking ? booking.name : <span style={styles.openLabel}>open</span>}</span>
            <span style={styles.colPhone}>{booking ? booking.phone || "" : ""}</span>
            <span style={styles.colEmail}>{booking ? booking.email : ""}</span>
            <span style={styles.colNotes}>{booking ? booking.notes || "" : ""}</span>
            <span style={styles.colAct}>{booking && <button style={styles.removeBtn} disabled={busy} onClick={() => removeBooking(slot.time, booking.name, slot.label)}>Remove</button>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  body: { padding: "20px 16px", maxWidth: 760, margin: "0 auto" },
  loading: { padding: 40, textAlign: "center", fontFamily: "sans-serif", color: "#888" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#3B2008", color: "#F5D78E", padding: "12px 24px", borderRadius: 10, fontFamily: "sans-serif", fontSize: 14, zIndex: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" },
  summaryRow: { display: "flex", gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, background: "white", borderRadius: 12, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 4 },
  summaryNum: { fontSize: 28, fontWeight: "bold", color: "#3B2008" },
  summaryLabel: { fontSize: 11, fontFamily: "sans-serif", color: "#888", textTransform: "uppercase", letterSpacing: "0.4px" },
  dayScroll: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" },
  dayBtn: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 14px", border: "2px solid #C9A96E", borderRadius: 10, background: "white", cursor: "pointer", minWidth: 80, gap: 2 },
  dayBtnActive: { background: "#3B2008", borderColor: "#3B2008", color: "#F5D78E" },
  dayBtnBlocked: { background: "#fdecea", borderColor: "#C0392B", color: "#C0392B" },
  dayBtnTop: { fontSize: 12, fontWeight: "bold", fontFamily: "sans-serif" },
  dayBtnSub: { fontSize: 11, fontFamily: "sans-serif", opacity: 0.75 },
  dayHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10, flexWrap: "wrap" },
  dayTitle: { margin: "0 0 2px", fontSize: 22, color: "#3B2008" },
  daySubtitle: { margin: 0, fontSize: 13, fontFamily: "sans-serif", color: "#888" },
  refreshBtn: { padding: "9px 14px", background: "#EDE0C4", color: "#7a5c2e", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  blockBtn: { padding: "9px 16px", background: "#C0392B", color: "white", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  unblockBtn: { background: "#4A7C3F" },
  blockedBanner: { background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, padding: "10px 14px", fontFamily: "sans-serif", fontSize: 13, color: "#922b21", marginBottom: 14 },
  rosterWrap: { background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  rosterHeader: { display: "flex", padding: "10px 14px", background: "#3B2008", color: "#F5D78E", fontFamily: "sans-serif", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" },
  rosterRow: { display: "flex", padding: "11px 14px", borderBottom: "1px solid #f0e8d8", alignItems: "center", fontFamily: "sans-serif", fontSize: 14 },
  colTime: { width: 90, flexShrink: 0 },
  colName: { flex: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  colPhone: { width: 130, flexShrink: 0, fontSize: 13, color: "#555" },
  colEmail: { flex: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, color: "#555" },
  colNotes: { flex: 1, minWidth: 0, fontSize: 13, color: "#777" },
  colAct: { width: 80, flexShrink: 0, textAlign: "right" },
  openLabel: { color: "#bbb", fontStyle: "italic" },
  removeBtn: { padding: "4px 10px", background: "#C0392B", color: "white", border: "none", borderRadius: 6, fontFamily: "sans-serif", fontSize: 12, cursor: "pointer" },
};
Displaying AdminView.jsx.
