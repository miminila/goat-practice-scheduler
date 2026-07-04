import { useState, useEffect } from "react";
import { DAILY_SLOTS, getDays, formatDate, formatDayLabel, loadBookings, adminRemove, setDayBlock, saveDayHours, clearDayHours, makeTimeOptions, isSlotAvailable, LUNCH_START, LUNCH_END } from "./utils";

const TIME_OPTS = makeTimeOptions();

function TimeSelect({ value, onChange, placeholder, minValue, maxValue }) {
  const filtered = TIME_OPTS.filter(o => {
    if (minValue != null && o.value <= minValue) return false;
    if (maxValue != null && o.value >= maxValue) return false;
    return true;
  });
  return (
    <select style={styles.timeSelect} value={value == null ? "" : value} onChange={e => onChange(e.target.value === "" ? null : parseInt(e.target.value))}>
      <option value="">{placeholder}</option>
      {filtered.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function AdminView() {
  const DAYS = getDays();
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [hoursError, setHoursError] = useState("");
  const [hoursForm, setHoursForm] = useState({ morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null, lunch_blocked: true });

  async function refresh() { setData(await loadBookings()); }
  useEffect(function() { refresh(); }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(function() {
    if (!data) return;
    const dk = formatDate(DAYS[selectedDay]);
    const h = (data.hours || {})[dk];
    if (h) {
      setHoursForm({ morning_start: h.morning_start, morning_end: h.morning_end, afternoon_start: h.afternoon_start, afternoon_end: h.afternoon_end, lunch_blocked: h.lunch_blocked !== false });
    } else {
      setHoursForm({ morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null, lunch_blocked: true });
    }
  }, [selectedDay, data]);

  if (!data) return <div style={styles.loading}>Loading...</div>;

  const bookings = data.bookings;
  const blocked = data.blocked || {};
  const hoursMap = data.hours || {};
  const dayKey = formatDate(DAYS[selectedDay]);
  const dayBookings = bookings[dayKey] || {};
  const isBlocked = !!blocked[dayKey];
  const dayHours = hoursMap[dayKey] || null;
  const bookedCount = Object.keys(dayBookings).length;
  const openCount = isBlocked ? 0 : DAILY_SLOTS.filter(s => isSlotAvailable(s.time, dayHours)).length - bookedCount;

  async function toggleBlock() {
    setBusy(true);
    await setDayBlock({ date: dayKey, blocked: !isBlocked });
    await refresh();
    setBusy(false);
    showToast(isBlocked ? "Day reopened." : "Day blocked.");
  }

  async function handleSaveHours() {
    setHoursError("");
    const { morning_start, morning_end, afternoon_start, afternoon_end } = hoursForm;
    const hasMorning = morning_start != null && morning_end != null;
    const hasAfternoon = afternoon_start != null && afternoon_end != null;
    if (morning_start != null && morning_end == null) { setHoursError("Please set a morning end time."); return; }
    if (morning_start == null && morning_end != null) { setHoursError("Please set a morning start time."); return; }
    if (afternoon_start != null && afternoon_end == null) { setHoursError("Please set an afternoon end time."); return; }
    if (afternoon_start == null && afternoon_end != null) { setHoursError("Please set an afternoon start time."); return; }
    if (hasMorning && morning_end <= morning_start) { setHoursError("Morning end time must be after morning start time."); return; }
    if (hasAfternoon && afternoon_end <= afternoon_start) { setHoursError("Afternoon end time must be after afternoon start time."); return; }
    if (hasMorning && hasAfternoon && afternoon_start <= morning_end) { setHoursError("Afternoon start must be after the morning window ends."); return; }
    if (!hasMorning && !hasAfternoon) { setHoursError("Please set at least one time window, or use Clear Custom Hours to restore the full day."); return; }
    setBusy(true);
    await saveDayHours(dayKey, hoursForm);
    await refresh();
    setBusy(false);
    setShowHours(false);
    setHoursError("");
    showToast("Hours saved for " + formatDayLabel(DAYS[selectedDay], selectedDay) + ".");
  }

  async function handleClearHours() {
    setBusy(true);
    await clearDayHours(dayKey);
    await refresh();
    setBusy(false);
    setShowHours(false);
    showToast("Custom hours cleared - full day restored.");
  }

  async function removeBooking(time, name, label) {
    if (!window.confirm("Remove " + name + " from " + label + "?")) return;
    setBusy(true);
    await adminRemove({ date: dayKey, slotTime: time });
    await refresh();
    setBusy(false);
    showToast(name + " removed.");
  }

  const roster = DAILY_SLOTS.map(slot => ({ slot, booking: dayBookings[slot.time] || null, available: isSlotAvailable(slot.time, dayHours) }));
  const totalBooked = DAYS.reduce((sum, d) => sum + Object.keys(bookings[formatDate(d)] || {}).length, 0);
  const hasCustomHours = !!dayHours;

  return (
    <div style={styles.body}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{totalBooked}</span><span style={styles.summaryLabel}>Booked 10 days</span></div>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{bookedCount}</span><span style={styles.summaryLabel}>Booked today</span></div>
        <div style={styles.summaryCard}><span style={styles.summaryNum}>{openCount}</span><span style={styles.summaryLabel}>Open today</span></div>
      </div>

      <div style={styles.dayScroll}>
        {DAYS.map((d, i) => {
          const dk = formatDate(d);
          const count = Object.keys(bookings[dk] || {}).length;
          const blk = blocked[dk];
          const custom = !!(hoursMap[dk]);
          return (
            <button key={i} style={{ ...styles.dayBtn, ...(selectedDay === i ? styles.dayBtnActive : {}), ...(blk ? styles.dayBtnBlocked : {}) }} onClick={() => { setSelectedDay(i); setShowHours(false); }}>
              <span style={styles.dayBtnTop}>{formatDayLabel(d, i)}</span>
              <span style={styles.dayBtnSub}>{blk ? "BLOCKED" : custom ? "Custom hrs" : count + "/" + DAILY_SLOTS.length}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.dayHeader}>
        <div>
          <h2 style={styles.dayTitle}>{formatDayLabel(DAYS[selectedDay], selectedDay)}</h2>
          <p style={styles.daySubtitle}>{DAYS[selectedDay].toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={styles.refreshBtn} disabled={busy} onClick={refresh}>Refresh</button>
          <button style={styles.hoursBtn} onClick={() => setShowHours(!showHours)}>
            {hasCustomHours ? "Edit Hours" : "Set Hours"}
          </button>
          <button style={{ ...styles.blockBtn, ...(isBlocked ? styles.unblockBtn : {}) }} disabled={busy} onClick={toggleBlock}>
            {isBlocked ? "Unblock Day" : "Block Day"}
          </button>
        </div>
      </div>

      {isBlocked && <div style={styles.blockedBanner}>This day is blocked. Click Unblock Day to reopen.</div>}

      {showHours && (
        <div style={styles.hoursPanel}>
          <h3 style={styles.hoursPanelTitle}>Custom Hours for {formatDayLabel(DAYS[selectedDay], selectedDay)}</h3>
          <p style={styles.hoursPanelHint}>Set morning and/or afternoon windows. Only slots within these times will be available to students. Leave blank to use the full default schedule.</p>

          <div style={styles.hoursSection}>
            <div style={styles.hoursSectionTitle}>Morning window</div>
            <div style={styles.hoursRow}>
              <TimeSelect value={hoursForm.morning_start} onChange={v => setHoursForm(f => ({ ...f, morning_start: v, morning_end: f.morning_end != null && v != null && f.morning_end <= v ? null : f.morning_end }))} placeholder="Start time" />
              <span style={styles.hoursTo}>to</span>
              <TimeSelect value={hoursForm.morning_end} onChange={v => setHoursForm(f => ({ ...f, morning_end: v }))} placeholder="End time" minValue={hoursForm.morning_start} />
            </div>
          </div>

          <div style={styles.hoursSection}>
            <div style={styles.hoursSectionTitle}>Afternoon window</div>
            <div style={styles.hoursRow}>
              <TimeSelect value={hoursForm.afternoon_start} onChange={v => setHoursForm(f => ({ ...f, afternoon_start: v, afternoon_end: f.afternoon_end != null && v != null && f.afternoon_end <= v ? null : f.afternoon_end }))} placeholder="Start time" minValue={hoursForm.morning_end} />
              <span style={styles.hoursTo}>to</span>
              <TimeSelect value={hoursForm.afternoon_end} onChange={v => setHoursForm(f => ({ ...f, afternoon_end: v }))} placeholder="End time" minValue={hoursForm.afternoon_start} />
            </div>
          </div>

          <div style={styles.hoursSection}>
            <div style={styles.hoursSectionTitle}>Lunch break (12:00 - 1:00 PM)</div>
            <label style={styles.lunchToggle}>
              <input type="checkbox" checked={hoursForm.lunch_blocked} onChange={e => setHoursForm(f => ({ ...f, lunch_blocked: e.target.checked }))} />
              <span style={{ marginLeft: 8 }}>Block lunch hour (recommended)</span>
            </label>
          </div>

          {hoursError && <p style={{ color: "#C0392B", fontFamily: "sans-serif", fontSize: 13, margin: "0 0 10px", background: "#fdecea", padding: "8px 12px", borderRadius: 8 }}>{hoursError}</p>}
          <div style={styles.hoursBtns}>
            <button style={styles.cancelHoursBtn} onClick={() => setShowHours(false)}>Cancel</button>
            {hasCustomHours && <button style={styles.clearHoursBtn} disabled={busy} onClick={handleClearHours}>Clear Custom Hours</button>}
            <button style={styles.saveHoursBtn} disabled={busy} onClick={handleSaveHours}>Save Hours</button>
          </div>
        </div>
      )}

      {hasCustomHours && !showHours && (
        <div style={styles.customHoursBanner}>
          Custom hours set: {dayHours.morning_start != null ? TIME_OPTS.find(o => o.value === dayHours.morning_start)?.label + " - " + TIME_OPTS.find(o => o.value === dayHours.morning_end)?.label : ""}{dayHours.morning_start != null && dayHours.afternoon_start != null ? " and " : ""}{dayHours.afternoon_start != null ? TIME_OPTS.find(o => o.value === dayHours.afternoon_start)?.label + " - " + TIME_OPTS.find(o => o.value === dayHours.afternoon_end)?.label : ""}{dayHours.lunch_blocked === false ? " (lunch open)" : ""}
        </div>
      )}

      <div style={styles.rosterWrap}>
        <div style={styles.rosterHeader}>
          <span style={styles.colTime}>Time</span>
          <span style={styles.colName}>Student</span>
          <span style={styles.colPhone}>Phone</span>
          <span style={styles.colEmail}>Email</span>
          <span style={styles.colAct}></span>
        </div>
        {roster.map(({ slot, booking, available }) => {
          const isLunch = slot.time >= LUNCH_START && slot.time < LUNCH_END;
          const bg = booking ? "#fff" : !available ? "#f5f0e8" : "#f9faf9";
          return (
            <div key={slot.time} style={{ ...styles.rosterRow, background: bg }}>
              <span style={styles.colTime}><strong style={{ color: !available && !booking ? "#bbb" : "#2c1a0e" }}>{slot.label}</strong></span>
              <span style={styles.colName}>
                {booking ? booking.name : !available ? <span style={styles.closedLabel}>{isLunch ? "lunch" : "closed"}</span> : <span style={styles.openLabel}>open</span>}
              </span>
              <span style={styles.colPhone}>{booking ? booking.phone || "" : ""}</span>
              <span style={styles.colEmail}>{booking ? booking.email : ""}</span>
              <span style={styles.colAct}>{booking && <button style={styles.removeBtn} disabled={busy} onClick={() => removeBooking(slot.time, booking.name, slot.label)}>Remove</button>}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  body: { padding: "20px 16px", maxWidth: 760, margin: "0 auto" },
  loading: { padding: 40, textAlign: "center", fontFamily: "sans-serif", color: "#888" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#3B2008", color: "#F5D78E", padding: "12px 24px", borderRadius: 10, fontFamily: "sans-serif", fontSize: 14, zIndex: 200 },
  summaryRow: { display: "flex", gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, background: "white", borderRadius: 12, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 4 },
  summaryNum: { fontSize: 28, fontWeight: "bold", color: "#3B2008" },
  summaryLabel: { fontSize: 11, fontFamily: "sans-serif", color: "#888", textTransform: "uppercase" },
  dayScroll: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "none" },
  dayBtn: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 14px", border: "2px solid #C9A96E", borderRadius: 10, background: "white", cursor: "pointer", minWidth: 80, gap: 2 },
  dayBtnActive: { background: "#3B2008", borderColor: "#3B2008", color: "#F5D78E" },
  dayBtnBlocked: { background: "#fdecea", borderColor: "#C0392B", color: "#C0392B" },
  dayBtnTop: { fontSize: 12, fontWeight: "bold", fontFamily: "sans-serif" },
  dayBtnSub: { fontSize: 10, fontFamily: "sans-serif", opacity: 0.75 },
  dayHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10, flexWrap: "wrap" },
  dayTitle: { margin: "0 0 2px", fontSize: 22, color: "#3B2008" },
  daySubtitle: { margin: 0, fontSize: 13, fontFamily: "sans-serif", color: "#888" },
  refreshBtn: { padding: "9px 14px", background: "#EDE0C4", color: "#7a5c2e", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  hoursBtn: { padding: "9px 16px", background: "#2471A3", color: "white", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  blockBtn: { padding: "9px 16px", background: "#C0392B", color: "white", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  unblockBtn: { background: "#4A7C3F" },
  blockedBanner: { background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, padding: "10px 14px", fontFamily: "sans-serif", fontSize: 13, color: "#922b21", marginBottom: 14 },
  customHoursBanner: { background: "#EBF5FB", border: "1px solid #AED6F1", borderRadius: 8, padding: "10px 14px", fontFamily: "sans-serif", fontSize: 13, color: "#1A5276", marginBottom: 14 },
  hoursPanel: { background: "white", border: "2px solid #AED6F1", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  hoursPanelTitle: { margin: "0 0 6px", fontSize: 17, color: "#3B2008" },
  hoursPanelHint: { margin: "0 0 16px", fontSize: 13, fontFamily: "sans-serif", color: "#666", lineHeight: 1.5 },
  hoursSection: { marginBottom: 16 },
  hoursSectionTitle: { fontFamily: "sans-serif", fontSize: 12, fontWeight: "bold", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 },
  hoursRow: { display: "flex", alignItems: "center", gap: 10 },
  hoursTo: { fontFamily: "sans-serif", fontSize: 13, color: "#888" },
  timeSelect: { padding: "8px 10px", border: "1.5px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 14, cursor: "pointer", flex: 1 },
  lunchToggle: { display: "flex", alignItems: "center", fontFamily: "sans-serif", fontSize: 13, color: "#555", cursor: "pointer" },
  hoursBtns: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" },
  cancelHoursBtn: { padding: "9px 16px", background: "#eee", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", color: "#555" },
  clearHoursBtn: { padding: "9px 16px", background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", color: "#922b21" },
  saveHoursBtn: { padding: "9px 20px", background: "#3B2008", color: "#F5D78E", border: "none", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, cursor: "pointer", fontWeight: "bold" },
  rosterWrap: { background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" },
  rosterHeader: { display: "flex", padding: "10px 14px", background: "#3B2008", color: "#F5D78E", fontFamily: "sans-serif", fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" },
  rosterRow: { display: "flex", padding: "11px 14px", borderBottom: "1px solid #f0e8d8", alignItems: "center", fontFamily: "sans-serif", fontSize: 14 },
  colTime: { width: 90, flexShrink: 0 },
  colName: { flex: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" },
  colPhone: { width: 130, flexShrink: 0, fontSize: 13, color: "#555" },
  colEmail: { flex: 1.4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: 13, color: "#555" },
  colAct: { width: 80, flexShrink: 0, textAlign: "right" },
  openLabel: { color: "#4A7C3F", fontStyle: "italic" },
  closedLabel: { color: "#bbb", fontStyle: "italic" },
  removeBtn: { padding: "4px 10px", background: "#C0392B", color: "white", border: "none", borderRadius: 6, fontFamily: "sans-serif", fontSize: 12, cursor: "pointer" },
};
