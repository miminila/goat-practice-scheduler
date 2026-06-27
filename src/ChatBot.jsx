import { useState } from "react";

const CHAT_URL = "https://kafxlwboepfekybipzog.supabase.co/functions/v1/chat";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Goat Practice assistant. Ask me how to book, cancel, or anything else about the schedule!" }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setBusy(true);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please call or text (760) 912-5441 for help!" }]);
    }
    setBusy(false);
  }

  return (
    <>
      <button style={s.bubble} onClick={() => setOpen(o => !o)} title="Chat with us">
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div style={s.window}>
          <div style={s.header}>
            <span>🐐 Goat Practice Assistant</span>
            <button style={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div style={s.messages}>
            {messages.map((m, i) => (
              <div key={i} style={{ ...s.msg, ...(m.role === "user" ? s.userMsg : s.botMsg) }}>
                {m.content}
              </div>
            ))}
            {busy && <div style={{ ...s.msg, ...s.botMsg }}>Thinking...</div>}
          </div>
          <div style={s.inputRow}>
            <input
              style={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Ask me anything..."
              disabled={busy}
              autoFocus
            />
            <button style={{ ...s.sendBtn, opacity: (!input.trim() || busy) ? 0.5 : 1 }} onClick={send} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  bubble: { position: "fixed", bottom: 24, right: 24, width: 58, height: 58, borderRadius: "50%", background: "#382000", color: "white", border: "none", fontSize: 26, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" },
  window: { position: "fixed", bottom: 94, right: 24, width: 340, height: 470, background: "white", borderRadius: 18, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", zIndex: 900, overflow: "hidden" },
  header: { background: "#382000", color: "white", padding: "14px 16px", fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  closeBtn: { background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 16, padding: 0 },
  messages: { flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: 10 },
  msg: { padding: "10px 14px", borderRadius: 14, fontFamily: "sans-serif", fontSize: 13, lineHeight: 1.5, maxWidth: "88%", wordBreak: "break-word" },
  botMsg: { background: "#f5efe8", color: "#2c1a0e", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  userMsg: { background: "#382000", color: "white", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  inputRow: { padding: "12px 14px", borderTop: "1px solid #eee", display: "flex", gap: 8, flexShrink: 0 },
  input: { flex: 1, padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontFamily: "sans-serif", fontSize: 13, outline: "none" },
  sendBtn: { padding: "9px 16px", background: "#382000", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "sans-serif", fontSize: 13, flexShrink: 0 },
};
