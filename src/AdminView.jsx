import { useState, useEffect } from "react";
import { DAILY_SLOTS, formatDate, formatDayLabel, loadBookings, adminRemove, setDayBlock, saveDayHours, clearDayHours, makeTimeOptions, isSlotAvailable, LUNCH_START, LUNCH_END, getDaysInRange, defaultDateRange, saveSettings } from "./utils";

const TIME_OPTS = makeTimeOptions();
const BOOKING_EMAIL_KEY = "041fdbc9-cf60-4674-a2e4-1ffa01ee0ab7";

// Sends ONE grouped notification email for a person covering every slot they booked on a given day.
async function resendGroupedNotification({ name, email, phone, day, slotLabels }) {
  const slotsText = slotLabels.join(", ");
  const countLabel = slotLabels.length + (slotLabels.length === 1 ? " slot" : " slots");
  const subject = "RESEND - Goat practice - " + name + ", " + day + " (" + countLabel + ")";
  const message = "This is a resent booking notification (sent manually from Coach View).\n\n" +
    "Name: " + name + "\nEmail: " + email + "\nPhone: " + phone + "\nDay: " + day + "\nTimes: " + slotsText;
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: BOOKING_EMAIL_KEY,
        subject,
        from_name: "Goat Practice",
        name, email, phone, day,
        slots: slotsText,
        message,
        botcheck: "",
      }),
    });
    const data = await res.json();
    return res.ok && data.success;
  } catch (_) {
    return false;
  }
}

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
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [hoursError, setHoursError] = useState("");
  const [hoursForm, setHoursForm] = useState({ morning_start: null, morning_end: null, afternoon_start: null, afternoon_end: null, lunch_blocked: true });
  const [showDateSettings, setShowDateSettings] = useState(false);
  const [dateError, setDateError] = useState("");
  const [dateForm, setDateForm] = useState({ start: "", end: "" });
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(function() {
    function onResize() { setIsMobile(window.innerWidth < 640); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const settings = (data && data.settings) || defaultDateRange();
  const DAYS = getDaysInRange(settings.startDate, settings.endDate);
  const selectedDayIndex = Math.min(selectedDay, DAYS.length - 1);

  async function refresh() { setData(await loadBookings()); }
  useEffect(function() { refresh(); }, []);

  useEffect(function() {
    if (data && data.settings) setDateForm({ start: data.settings.startDate, end: data.settings.endDate });
  }, [data]);

  async function handleSaveDates() {
    setDateError("");
    if (!dateForm.start || !dateForm.end) { setDateError("Please choose both a start and end date."); return; }
    if (dateForm.end < dateForm.start) { setDateError("End date must be on or after the start date."); return; }
    const spanDays = Math.round((new Date(dateForm.end) - new Date(dateForm.start)) / 86400000) + 1;
    if (spanDays > 31) { setDateError("Please choose a range of 31 days or fewer."); return; }
    setBusy(true);
    const res = await saveSettings(dateForm.start, dateForm.end);
    setBusy(false);
    if (!res.ok) { setDateError("Could not save dates. Please try again."); return; }
    await refresh();
    setSelectedDay(0);
    setShowDateSettings(false);
    showToast("Practice dates updated.");
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(function() {
    if (!data) return;
    const dk = formatDate(DAYS[selectedDayIndex]);
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
  const hoursMap =
