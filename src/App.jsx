import { useState, useEffect } from "react";
import BookingView from "./BookingView";
import AdminView from "./AdminView";

export default function App() {
  const [page, setPage] = useState("book"); // "book" | "cancel" | "admin"
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "Goat$2026";

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setAdminError("");
    } else {
      setAdminError("Incorrect password.");
    }
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>🐐</span>
          <div>
            <h1 style={styles.title}>Goat Practice</h1>
            <p style={styles.subtitle}>Book · Cancel · Manage</p>
          </div>
        </div>
        <div style={styles.navRow}>
          <button style={{ ...styles.navBtn, ...(page === "book" ? styles.navActive : {}) }} onClick={() => setPage("book")}>Book a Slot</button>
          <button style={{ ...styles.navBtn, ...(page === "cancel" ? styles.navActive : {}) }} onClick={() => setPage("cancel")}>Cancel My Slot</button>
          <button style={{ ...styles.navBtn, ...(page === "admin" ? styles.navActive : {}) }} onClick={() => setPage("admin")}>Coach View</button>
        </div>
      </div>

      {/* Body */}
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
                <div style={styles.passwordWrap}>
                  <input
                    style={styles.input}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={adminInput}
                    onChange={e => setAdminInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                  />
                  <button
                    type="button"
                    style={styles.showPasswordBtn}
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {adminError && <p style={styles.errorMsg}>{adminError}</p>}
                <button style={styles.loginBtn} onClick={handleAdminLogin}>Enter</button>
              </div>
            </div>
          )
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          Questions or issues with this site? Contact{" "}
          <a href="mailto:stockdogcoursedirector2026@gmail.com" style={styles.footerLink}>
            stockdogcoursedirector2026@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#F5EFE0", fontFamily: "'Georgia', serif", color: "#2c1a0e" },
  header: { background: "linear-gradient(135deg, #3B2008 0%, #6B3A1F 100%)", padding: "24px 20px 0", color: "#F5EFE0" },
  headerInner: { display: "flex", alignItems: "center", gap: 14, marginBottom: 20 },
  logo: { fontSize: 42, lineHeight: 1 },
  title: { margin: 0, fontSize: 28, fontWeight: "bold", color: "#F5D78E", letterSpacing: "-0.5px" },
  subtitle: { margin: "2px 0 0", fontSize: 13, color: "#C9A96E", fontFamily: "sans-serif" },
  navRow: { display: "flex", gap: 4 },
  navBtn: { flex: 1, padding: "10px 0", border: "none", borderRadius: "8px 8px 0 0", background: "rgba(255,255,255,0.12)", color: "#C9A96E", fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer" },
  navActive: { background: "#F5EFE0", color: "#3B2008", fontWeight: "bold" },
  loginWrap: { display: "flex", justifyContent: "center", padding: "60px 20px" },
  loginBox: { background: "white", borderRadius: 16, padding: 36, width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.10)", textAlign: "center" },
  loginIcon: { fontSize: 40, marginBottom: 12 },
  loginTitle: { margin: "0 0 6px", fontSize: 22, color: "#3B2008" },
  loginHint: { margin: "0 0 20px", fontSize: 13, fontFamily: "sans-serif", color: "#666" },
  input: { width: "100%", padding: "11px 40px 11px 14px", border: "1.5px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 15, marginBottom: 0, boxSizing: "border-box" },
  passwordWrap: { position: "relative", marginBottom: 10 },
  showPasswordBtn: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: 6, lineHeight: 1 },
  errorMsg: { color: "#C0392B", fontFamily: "sans-serif", fontSize: 13, margin: "0 0 10px" },
  loginBtn: { width: "100%", padding: "12px 0", background: "#3B2008", color: "#F5D78E", border: "none", borderRadius: 8, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer", fontWeight: "bold" },
  footer: { padding: "24px 20px 32px", textAlign: "center" },
  footerText: { margin: 0, fontSize: 12, fontFamily: "sans-serif", color: "#8a7355" },
  footerLink: { color: "#6B3A1F", fontWeight: "bold", textDecoration: "none" },
};
