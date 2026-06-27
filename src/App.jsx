import { useState, useEffect } from "react";
import BookingView from "./BookingView";
import AdminView from "./AdminView";
import ChatBot from "./ChatBot";
import { getSettings } from "./utils";

export default function App() {
  const [page, setPage] = useState("book");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "ASCA$$0577";

  useEffect(() => {
    getSettings().then(s => setContactPhone(s.contact_phone || ""));
  }, []);

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setAdminError("");
      setAdminInput("");
    } else {
      setAdminError("Incorrect password.");
    }
  }

  function handleLogout() {
    setAdminUnlocked(false);
    setAdminInput("");
    setAdminError("");
    setPage("book");
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>🐐</span>
          <div>
            <h1 style={styles.title}>Goat Practice</h1>
            <p style={styles.subtitle}>Book · Cancel · Manage</p>
          </div>
          {adminUnlocked && (
            <button style={styles.logoutBtn} onClick={handleLogout}>🔓 Log Out</button>
          )}
        </div>
        {contactPhone ? (
          <div style={styles.phoneBar}>
            📞 Questions? Call or text: <strong>{contactPhone}</strong>
          </div>
        ) : null}
        <div style={styles.navRow}>
          <button style={{ ...styles.navBtn, ...(page === "book" ? styles.navActive : {}) }} onClick={() => setPage("book")}>Book a Slot</button>
          <button style={{ ...styles.navBtn, ...(page === "cancel" ? styles.navActive : {}) }} onClick={() => setPage("cancel")}>Cancel My Slot</button>
          <button style={{ ...styles.navBtn, ...(page === "admin" ? styles.navActive : {}) }} onClick={() => setPage("admin")}>Coach View</button>
        </div>
      </div>

      {page === "book" && <BookingView mode="book" />}
      {page === "cancel" && <BookingView mode="cancel" />}
      {page === "admin" && (
        adminUnlocked
          ? <AdminView />
          : (
            <div style={styles.loginWrap}>
              <div style={styles.loginBox}>
                <div style={styles.loginIcon}>🔒</div>
                <h2 style={styles.loginTitle}>Coach Access</h2>
                <p style={styles.loginHint}>Enter your password to view the full schedule.</p>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Password"
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                />
                {adminError && <p style={styles.errorMsg}>{adminError}</p>}
                <button style={styles.loginBtn} onClick={handleAdminLogin}>Enter</button>
              </div>
            </div>
          )
      )}

      <ChatBot />
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#F5EFE8", fontFamily: "'Georgia', serif", color: "#2c1a0e" },
  header: { background: "linear-gradient(135deg, #382000, #683A1F 100%)", padding: "24px 20px 0", color: "#F5EFF0" },
  headerInner: { display: "flex", alignItems: "center", gap: 16, marginBottom: 8 },
  logo: { fontSize: 42, lineHeight: 1 },
  title: { margin: 0, fontSize: 28, fontWeight: "bold", color: "#F5D7BE", letterSpacing: "-0.5px" },
  subtitle: { margin: "2px 0", fontSize: 13, color: "#C9A96E" },
  logoutBtn: { marginLeft: "auto", padding: "6px 14px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, color: "white", cursor: "pointer", fontFamily: "sans-serif", fontSize: 13 },
  phoneBar: { background: "rgba(255,255,255,0.13)", borderRadius: 8, padding: "8px 14px", marginBottom: 10, fontFamily: "sans-serif", fontSize: 14, color: "#fff" },
  navRow: { display: "flex", gap: 4 },
  navBtn: { flex: 1, padding: "10px 0", border: "none", borderRadius: "8px 8px 0 0", background: "rgba(255,255,255,0.12)", color: "#C9A96E", fontFamily: "'Georgia', serif", fontSize: 13, cursor: "pointer" },
  navActive: { background: "#F5EFE8", color: "#382000", fontWeight: "bold" },
  loginWrap: { display: "flex", justifyContent: "center", padding: "60px 20px" },
  loginBox: { background: "white", borderRadius: 16, padding: 32, maxWidth: 360, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", textAlign: "center" },
  loginIcon: { fontSize: 40, marginBottom: 12 },
  loginTitle: { margin: "0 0 8px", fontSize: 22, color: "#382000" },
  loginHint: { margin: "0 0 20px", fontFamily: "sans-serif", fontSize: 13, color: "#666" },
  input: { width: "100%", padding: "12px 14px", fontSize: 15, marginBottom: 10, border: "1px solid #ddd", borderRadius: 8, boxSizing: "border-box" },
  errorMsg: { color: "#C83028", fontFamily: "sans-serif", fontSize: 13, marginBottom: 10 },
  loginBtn: { width: "100%", padding: "12px 0", background: "#382000", color: "#F5D7BE", border: "none", borderRadius: 8, fontFamily: "'Georgia', serif", fontSize: 15, cursor: "pointer" },
};
