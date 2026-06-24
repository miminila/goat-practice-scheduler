import { useState, useEffect } from "react";
import { DAILY_SLOTS, getDays, formatDate, formatDayLabel, loadBookings, saveBookings } from "./utils";

export default function AdminView() {
  const DAYS = getDays();
  const [bookings, setBookings] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [blockedDays, setBlockedDays] = useState(() => {
    try { return JSON.parse(localStorage.getItem("goat-blocked-days") || "{}"); } catch { return {}; }
  });
  const [toast, setToast] = useState("");

  useEffect(() => { loadBookings().then(setBookings); }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const dayKey = formatDate(DAYS[selectedDay]);
  const dayBookings = bookings?.[dayKey] || {};
  const isBlocked = blockedDays[dayKey];
  const bookedCount = Object.keys(dayBookings).length;
  const openCount = DAILY_SLOTS.length - bookedCount;

  async function toggleBlock() {
    const updated = { ...blockedDays };
    if (isBlocked) { delete updated[dayKey]; showToast("Day unblocked — slots are open again."); }
    else { updated[dayKey] = true; showToast("Day blocked — no new bookings allowed."); }
    setBlockedDays(updated);
    localStorage.setItem("goat-blocked-days", JSON.stringify(updated));
  }

  async function clearSlot(time) {
    const b = bookings[dayKey]?.[time];
    if (!b) return;
    if (!window.confirm(`Remove ${b.name}'s booking at ${DAILY_SLOTS.find(s => s.time === parseInt(time))?.label}?`)) return;
    const updated = { ...bookings, [dayKey]: { ...bookings[dayKey] } };
    delete updated[dayKey][time];
    if (!Object.keys(updated[dayKey]).length) delete updated[dayKey];
    setBookings(updated);
    await saveBookings(updated);
    showToast(`${b.name}'s slot removed.`);
  }

  if (!bookings) return <div style={styles.loading}>Loading…</div>;

  // Build full day roster: all slots with their status
  const roster = DAILY_SLOTS.map(slot => ({
    slot,
    booking: dayBookings[slot.time] || null,
  }));

  // Summary across all 10 days
  const totalBooked = DAYS.reduce((sum, d) => {
    const dk = formatDate(d);
    return sum + Object.keys(bookings[dk] || {}).length;
  }, 0);

  return (
    <div style={styles.body}>
      {toast && <div style={styles.toast}>{toast}</div>}

      {/* Summary bar */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{totalBooked}</span>
          <span style={styles.summaryLabel}>Total booked (10 days)</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{bookedCount}</span>
          <span style={styles.summaryLabel}>Booked today's view</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNum}>{openCount}</span>
          <span style={styles.summaryLabel}>Open today's view</span>
        </div>
      </div>

      {/* Day tabs */}
      <div style={styles.dayScroll}>
        {DAYS.map((d, i) => {
          const dk = formatDate(d);
          const count = Object.keys(bookings[dk] || {}).length;
          const blocked = blockedDays[dk];
          return (
            <button key={i} style={{ ...styles.dayBtn, ...(selectedDay === i ? styles.dayBtnActive : {}), ...(blocked ? styles.dayBtnBlocked : {}) }}
              onClick={() => setSelectedDay(i)}>
              <span style={styles.dayBtnTop}>{formatDayLabel(d, i)}</span>
              <span style={styles.dayBtnSub}>{blocked ? "BLOCKED" : `${count}/${DAILY_SLOTS.length}`}</span>
            </button>
          );
        })}
      </div>

      {/* Day controls */}
      <div style={styles.dayHeader}>
        <div>
          <h2 style={styles.dayTitle}>{formatDayLabel(DAYS[selectedDay], selectedDay)}</h2>
          <p style={styles.daySubtitle}>{DAYS[selectedDay].toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <button style={{ ...styles.blockBtn, ...(isBlocked ? styles.unblockBtn : {}) }} onClick={toggleBlock}>
          {isBlocked ? "✅ Unblock Day" : "🚫 Block Day"}
        </button>
      </div>

      {isBlocked && (
        <div style={styles.blockedBanner}>
          🚫 This day is blocked — students cannot book new slots. Click "Unblock Day" to reopen.
        </div>
      )}

      {/* Roster table */}
      <div style={styles.rosterWrap}>
        <div style={styles.rosterHeader}>
          <span style={styles.rosterCol}>Time</span>
          <span style={{ ...styles.rosterCol, flex: 2 }}>Student</span>
          <span style={styles.rosterCol}>Phone</span>
          <span style={styles.rosterCol}>Action</span>
        </div>
        {roster.map(({ slot, booking }) => (
          <div key={slot.time} style={{ ...styles.rosterRow, ...(booking ? styles.rosterBooked : styles.rosterOpen) }}>
            <span style={{ ...styles.rosterCol, fontWeight: "bold", fontFamily: "sans-serif" }}>{slot.label}</span>
            <span style={{ ...styles.rosterCol, flex: 2, fontFamily: "sans-serif" }}>{booking ? booking.name : <span style={styles.openLabel}>— open —</span>}</span>
            <span style={{ ...styles.rosterCol, fontFamily: "sans-serif", fontSize: 13, color: "#555" }}>
              {booking ? `(${booking.phone.slice(0,3)}) ${booking.phone.slice(3,6)}-${booking.phone.slice(6)}` : ""}
            </span>
            <span style={styles.rosterCol}>
              {booking && (
                <button style={styles.removeBtn} onClick={() => clearSlot(slot.time)}>Remove</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  body: { padding: "20px 16px", maxWidth: 680, margin: "0 auto" },
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
  dayHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  dayTitle: { margin: "0 0 2px", fontSize: 22, color: "#3B2008" },
  daySubtitle: { margin: 0, fontSize: 13, fontFamily: "sans-serif", color: "#888" },
  blockBtn: { padding: "9px 16px", background: "#C0392B", color: "white", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  unblockBtn: { background: "#4A7C3F" },
  blockedBanner: { background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, padding: "10px 14px", fontFamily: "sans-serif", fontSize: 13, color: "#922b21", marginBottom: 14 },
  rosterWrap: { background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  rosterHeader: { display: "flex", padding: "10px 14px", background: "#3B2008", color: "#F5D78E", fontFamily: "sans-serif", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" },
  rosterRow: { display: "flex", padding: "11px 14px", borderBottom: "1px solid #f0e8d8", alignItems: "center" },
  rosterBooked: { background: "#fff" },
  rosterOpen: { background: "#f9f6f0" },
  rosterCol: { flex: 1, fontSize: 14 },
  openLabel: { color: "#bbb", fontStyle: "italic" },
  removeBtn: { padding: "4px 10px", background: "#C0392B", color: "white", border: "none", borderRadius: 6, fontFamily: "sans-serif", fontSize: 12, cursor: "pointer" },
};
