import { useState, useEffect } from "react";
import { DAILY_SLOTS, getDays, formatDate, formatDayLabel, loadBookings, adminRemove, setDayBlock, addBooking, getSettings, saveSetting } from "./utils";

export default function AdminView() {
  const DAYS = getDays();
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState({ contact_phone: "" });
  const [editPhone, setEditPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [addingSlot, setAddingSlot] = useState(null);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [activeTab, setActiveTab] = useState("schedule");

  async function refresh() {
    setBusy(true);
    const [d, s] = await Promise.all([loadBookings(), getSettings()]);
    setData(d);
    setSettings(s);
    setEditPhone(s.contact_phone || "");
    setBusy(false);
  }

  useEffect(() => { refresh(); }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function toggleBlock() {
    const db = formatDate(selectedDay);
    const isBlocked = !!(data && data.blocked[db]);
    setBusy(true);
    await setDayBlock({ date: db, blocked: !isBlocked });
    await refresh();
    showToast(isBlocked ? "Day unblocked — students can book again." : "Day blocked — no new bookings allowed.");
  }

  async function removeBooking(slotTime, slotLabel, date) {
    if (!window.confirm("Remove the booking at " + slotLabel + "?")) return;
    setBusy(true);
    await adminRemove({ date: date || formatDate(selectedDay), slotTime });
    await refresh();
    showToast("Booking removed.");
  }

  async function handleAddBooking() {
    if (!addName.trim() || !addEmail.trim()) { showToast("Name and email are required."); return; }
    setBusy(true);
    const result = await addBooking({
      date: formatDate(selectedDay),
      slotTime: addingSlot.slotTime,
      slotLabel: addingSlot.slotLabel,
      name: addName.trim(),
      email: addEmail.trim(),
      phone: addPhone.trim(),
      notes: addNotes.trim()
    });
    if (result.ok) {
      setAddingSlot(null);
      setAddName(""); setAddEmail(""); setAddPhone(""); setAddNotes("");
      await refresh();
      showToast("Booking added!");
    } else {
      showToast(result.error === "taken" ? "That slot is already taken." : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  async function handleSavePhone() {
    setBusy(true);
    await saveSetting("contact_phone", editPhone);
    setSettings(s => ({ ...s, contact_phone: editPhone }));
    setEditingPhone(false);
    setBusy(false);
    showToast("Contact phone updated!");
  }

  if (!data) return <div style={s.loading}>Loading schedule...</div>;

  const db = formatDate(selectedDay);
  const dayBookings = data.bookings[db] || {};
  const isBlocked = !!data.blocked[db];
  const selectedDayIndex = DAYS.findIndex(d => formatDate(d) === db);

  const totalBooked = DAYS.reduce((sum, d) => {
    return sum + Object.keys(data.bookings[formatDate(d)] || {}).length;
  }, 0);
  const openToday = DAILY_SLOTS.length - Object.keys(dayBookings).length;
  const totalOpen = DAYS.length * DAILY_SLOTS.length - totalBooked;

  // Build flat list of all bookings sorted by date then time
  const allBookings = [];
  for (const d of DAYS) {
    const key = formatDate(d);
    const dayB = data.bookings[key] || {};
    for (const slot of DAILY_SLOTS) {
      if (dayB[slot.time]) {
        allBookings.push({
          date: key,
          dayLabel: formatDayLabel(d, DAYS.indexOf(d)),
          slotTime: slot.time,
          slotLabel: slot.label,
          ...dayB[slot.time]
        });
      }
    }
  }

  return (
    <div style={s.body}>
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Summary */}
      <div style={s.summaryCard}>
        <div style={s.summaryItem}>
          <span style={s.summaryNum}>{totalBooked}</span>
          <span style={s.summaryLabel}>Total Booked</span>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <span style={s.summaryNum}>{openToday}</span>
          <span style={s.summaryLabel}>Open Today</span>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <span style={s.summaryNum}>{totalOpen}</span>
          <span style={s.summaryLabel}>Open Total</span>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <span style={s.summaryNum}>{DAILY_SLOTS.length}</span>
          <span style={s.summaryLabel}>Slots/Day</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        <button style={{ ...s.tab, ...(activeTab === "schedule" ? s.tabActive : {}) }} onClick={() => setActiveTab("schedule")}>
          📅 Schedule View
        </button>
        <button style={{ ...s.tab, ...(activeTab === "roster" ? s.tabActive : {}) }} onClick={() => setActiveTab("roster")}>
          📋 All Signups ({totalBooked})
        </button>
        <button style={{ ...s.tab, ...(activeTab === "settings" ? s.tabActive : {}) }} onClick={() => setActiveTab("settings")}>
          ⚙️ Settings
        </button>
        <button style={s.refreshTab} disabled={busy} onClick={refresh}>
          {busy ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* SCHEDULE TAB */}
      {activeTab === "schedule" && (
        <>
          <div style={s.dayStrip}>
            {DAYS.map((d, i) => {
              const key = formatDate(d);
              const booked = Object.keys(data.bookings[key] || {}).length;
              const blocked = !!data.blocked[key];
              const isSelected = key === db;
              return (
                <button key={key} style={{ ...s.dayBtn, ...(isSelected ? s.dayBtnActive : {}), ...(blocked ? s.dayBtnBlocked : {}) }} onClick={() => setSelectedDay(d)}>
                  <span style={s.dayBtnLabel}>{formatDayLabel(d, i)}</span>
                  <span style={s.dayBtnCount}>{blocked ? "BLOCKED" : booked + "/" + DAILY_SLOTS.length}</span>
                </button>
              );
            })}
          </div>

          <div style={s.dayHeader}>
            <h2 style={s.dayTitle}>{formatDayLabel(selectedDay, selectedDayIndex)} &mdash; {db}</h2>
            <button style={{ ...s.blockBtn, ...(isBlocked ? s.unblockBtn : {}) }} disabled={busy} onClick={toggleBlock}>
              {isBlocked ? "Unblock Day" : "Block Day"}
            </button>
          </div>

          {isBlocked && <div style={s.blockedBanner}>This day is blocked — students cannot book. Click "Unblock Day" to reopen.</div>}

          <div style={s.slotGrid}>
            {DAILY_SLOTS.map(slot => {
              const booking = dayBookings[slot.time];
              return (
                <div key={slot.time} style={{ ...s.slotCard, ...(booking ? s.slotBooked : s.slotOpen) }}>
                  <div style={s.slotTime}>{slot.label}</div>
                  {booking ? (
                    <div style={s.slotInfo}>
                      <div style={s.slotName}>{booking.name}</div>
                      <div style={s.slotDetail}>{booking.email}</div>
                      {booking.phone ? <div style={s.slotDetail}>📞 {booking.phone}</div> : null}
                      {booking.notes ? <div style={s.slotDetail}>📝 {booking.notes}</div> : null}
                      <button style={s.removeBtn} disabled={busy} onClick={() => removeBooking(slot.time, slot.label, db)}>Remove</button>
                    </div>
                  ) : (
                    <div style={s.slotInfo}>
                      <div style={s.slotAvail}>Available</div>
                      {!isBlocked && (
                        <button style={s.addBtn} disabled={busy} onClick={() => {
                          setAddingSlot({ slotTime: slot.time, slotLabel: slot.label });
                          setAddName(""); setAddEmail(""); setAddPhone(""); setAddNotes("");
                        }}>+ Add</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ALL SIGNUPS TAB */}
      {activeTab === "roster" && (
        <div style={s.rosterWrap}>
          {allBookings.length === 0 ? (
            <div style={s.emptyMsg}>No bookings yet across any days.</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>Time</th>
                    <th style={s.th}>Name</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>Notes</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {allBookings.map((b, i) => (
                    <tr key={b.date + "-" + b.slotTime} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                      <td style={s.td}>
                        <div style={s.tdDate}>{b.dayLabel}</div>
                        <div style={s.tdSub}>{b.date}</div>
                      </td>
                      <td style={s.td}>{b.slotLabel}</td>
                      <td style={{ ...s.td, fontWeight: "bold" }}>{b.name}</td>
                      <td style={s.td}>{b.email}</td>
                      <td style={s.td}>{b.phone || "—"}</td>
                      <td style={s.td}>{b.notes || "—"}</td>
                      <td style={s.td}>
                        <button style={s.removeBtn} disabled={busy} onClick={() => removeBooking(b.slotTime, b.slotLabel, b.date)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === "settings" && (
        <div style={s.settingsCard}>
          <h3 style={s.settingsTitle}>Settings</h3>
          <div style={s.settingsRow}>
            <span style={s.settingsLabel}>Contact Phone:</span>
            {editingPhone ? (
              <>
                <input style={s.settingsInput} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. (760) 912-5441" />
                <button style={s.settingsSave} disabled={busy} onClick={handleSavePhone}>Save</button>
                <button style={s.settingsCancel} onClick={() => { setEditingPhone(false); setEditPhone(settings.contact_phone || ""); }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={s.settingsValue}>{settings.contact_phone || "Not set"}</span>
                <button style={s.settingsEdit} onClick={() => setEditingPhone(true)}>Edit</button>
              </>
            )}
          </div>
          <p style={s.settingsHint}>This number appears at the top of the booking page so students can contact you.</p>
        </div>
      )}

      {/* Add Booking Modal */}
      {addingSlot && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Add Booking</h3>
            <p style={s.modalSub}>{addingSlot.slotLabel} &mdash; {db}</p>
            <input style={s.modalInput} placeholder="Name *" value={addName} onChange={e => setAddName(e.target.value)} />
            <input style={s.modalInput} placeholder="Email *" value={addEmail} onChange={e => setAddEmail(e.target.value)} />
            <input style={s.modalInput} placeholder="Phone" value={addPhone} onChange={e => setAddPhone(e.target.value)} />
            <input style={s.modalInput} placeholder="Notes (optional)" value={addNotes} onChange={e => setAddNotes(e.target.value)} />
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setAddingSlot(null)}>Cancel</button>
              <button style={s.modalSave} disabled={busy} onClick={handleAddBooking}>Save Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  body: { padding: "16px", maxWidth: 900, margin: "0 auto" },
  loading: { textAlign: "center", padding: 40, color: "#888", fontFamily: "sans-serif" },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "#2c1a0e", color: "#fff", padding: "10px 24px", borderRadius: 8, zIndex: 1000, fontFamily: "sans-serif", fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" },
  summaryCard: { display: "flex", background: "white", borderRadius: 12, padding: "16px 24px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "space-around" },
  summaryItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 26, fontWeight: "bold", color: "#382000" },
  summaryLabel: { fontSize: 11, color: "#999", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: 1 },
  summaryDivider: { width: 1, height: 40, background: "#eee" },
  tabRow: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
  tab: { padding: "9px 18px", borderRadius: 10, border: "2px solid #e0d4c8", background: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13, color: "#555" },
  tabActive: { border: "2px solid #382000", background: "#382000", color: "white", fontWeight: "bold" },
  refreshTab: { marginLeft: "auto", padding: "9px 18px", borderRadius: 10, border: "1px solid #ccc", background: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  dayStrip: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 },
  dayBtn: { flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: "2px solid #e0d4c8", background: "white", cursor: "pointer", fontFamily: "sans-serif", textAlign: "center", minWidth: 88 },
  dayBtnActive: { border: "2px solid #382000", background: "#382000", color: "white" },
  dayBtnBlocked: { opacity: 0.5, background: "#f5f5f5" },
  dayBtnLabel: { display: "block", fontSize: 12, fontWeight: "bold" },
  dayBtnCount: { display: "block", fontSize: 11, marginTop: 2, opacity: 0.8 },
  dayHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  dayTitle: { margin: 0, fontSize: 17, color: "#382000", fontFamily: "sans-serif" },
  blockBtn: { padding: "6px 14px", borderRadius: 8, border: "none", background: "#c0392b", color: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  unblockBtn: { background: "#27ae60" },
  blockedBanner: { background: "#ffeaa7", border: "1px solid #fdcb6e", borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontFamily: "sans-serif", fontSize: 13, color: "#2d3436" },
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginBottom: 24 },
  slotCard: { borderRadius: 10, padding: "12px 14px", border: "2px solid", display: "flex", flexDirection: "column", gap: 6 },
  slotBooked: { background: "#fff8f5", borderColor: "#e17055" },
  slotOpen: { background: "#f0fff4", borderColor: "#00b894" },
  slotTime: { fontWeight: "bold", fontSize: 13, fontFamily: "sans-serif", color: "#2c1a0e" },
  slotInfo: { display: "flex", flexDirection: "column", gap: 3 },
  slotName: { fontFamily: "sans-serif", fontSize: 13, fontWeight: "bold", color: "#2c1a0e" },
  slotDetail: { fontFamily: "sans-serif", fontSize: 11, color: "#666" },
  slotAvail: { fontFamily: "sans-serif", fontSize: 12, color: "#00b894", fontWeight: "bold" },
  removeBtn: { marginTop: 4, padding: "4px 10px", background: "#e17055", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "sans-serif", fontSize: 11, alignSelf: "flex-start" },
  addBtn: { marginTop: 4, padding: "4px 10px", background: "#00b894", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "sans-serif", fontSize: 11, alignSelf: "flex-start" },
  rosterWrap: { marginBottom: 24 },
  emptyMsg: { textAlign: "center", padding: 40, color: "#aaa", fontFamily: "sans-serif", fontSize: 15 },
  tableWrap: { overflowX: "auto", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  table: { width: "100%", borderCollapse: "collapse", background: "white", fontFamily: "sans-serif", fontSize: 13 },
  th: { background: "#382000", color: "white", padding: "12px 14px", textAlign: "left", fontWeight: "bold", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" },
  td: { padding: "11px 14px", color: "#2c1a0e", verticalAlign: "middle", borderBottom: "1px solid #f0ebe5" },
  tdDate: { fontWeight: "bold", fontSize: 13 },
  tdSub: { fontSize: 11, color: "#999", marginTop: 2 },
  rowEven: { background: "white" },
  rowOdd: { background: "#faf7f4" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 },
  modal: { background: "white", borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" },
  modalTitle: { margin: "0 0 4px 0", fontFamily: "sans-serif", color: "#382000", fontSize: 18 },
  modalSub: { margin: "0 0 16px 0", fontFamily: "sans-serif", color: "#888", fontSize: 13 },
  modalInput: { width: "100%", padding: "10px 12px", marginBottom: 10, border: "1px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 14, boxSizing: "border-box" },
  modalBtns: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  modalCancel: { padding: "8px 18px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 14 },
  modalSave: { padding: "8px 18px", borderRadius: 8, border: "none", background: "#382000", color: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 14 },
  settingsCard: { background: "white", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: 24 },
  settingsTitle: { margin: "0 0 16px 0", fontFamily: "sans-serif", color: "#382000", fontSize: 16 },
  settingsRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  settingsLabel: { fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", color: "#2c1a0e", minWidth: 130 },
  settingsValue: { fontFamily: "sans-serif", fontSize: 14, color: "#444" },
  settingsInput: { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 14, minWidth: 180 },
  settingsEdit: { padding: "6px 14px", borderRadius: 8, border: "1px solid #382000", background: "white", color: "#382000", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  settingsSave: { padding: "6px 14px", borderRadius: 8, border: "none", background: "#382000", color: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  settingsCancel: { padding: "6px 14px", borderRadius: 8, border: "1px solid #ccc", background: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  settingsHint: { margin: "12px 0 0 0", fontFamily: "sans-serif", fontSize: 12, color: "#aaa" },
};
