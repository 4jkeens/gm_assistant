"use client";

import { useEffect, useState } from "react";

const PIN_HASH = "05734f848cef55ba13447e262e1133d04c6bae245361d97c3febd9ef658551c3";
const STORAGE_KEY = "gm-dashboard-pin-unlocked";

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUnlocked(localStorage.getItem(STORAGE_KEY) === "yes");
    setChecking(false);
  }, []);

  const enterDigit = async (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setMessage("");

    if (next.length === 4) {
      const hashed = await sha256(next);
      if (hashed === PIN_HASH) {
        localStorage.setItem(STORAGE_KEY, "yes");
        setUnlocked(true);
        setPin("");
      } else {
        setMessage("Incorrect PIN");
        setTimeout(() => setPin(""), 350);
      }
    }
  };

  if (checking) {
    return <main style={styles.shell} />;
  }

  if (unlocked) return <>{children}</>;

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <div style={styles.logo}>GM</div>
        <h1 style={styles.title}>GM Dashboard</h1>
        <p style={styles.subtitle}>Enter PIN</p>

        <div style={styles.dots}>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              style={{
                ...styles.dot,
                background: index < pin.length ? "#2f9cff" : "transparent",
              }}
            />
          ))}
        </div>

        <div style={styles.pad}>
          {["1","2","3","4","5","6","7","8","9"].map((digit) => (
            <button key={digit} style={styles.key} onClick={() => enterDigit(digit)}>
              {digit}
            </button>
          ))}
          <button
            style={{ ...styles.key, color: "#8fa0b4" }}
            onClick={() => {
              setPin("");
              setMessage("");
            }}
          >
            Clear
          </button>
          <button style={styles.key} onClick={() => enterDigit("0")}>0</button>
          <button
            style={{ ...styles.key, color: "#8fa0b4" }}
            onClick={() => setPin((current) => current.slice(0, -1))}
          >
            ←
          </button>
        </div>

        <div style={styles.message}>{message || " "}</div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at 50% 8%, rgba(45,156,255,.12), transparent 28rem), linear-gradient(145deg,#070b10,#0b1118)",
    color: "#f4f7fb",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: "min(390px, 92vw)",
    border: "1px solid #263241",
    background: "linear-gradient(180deg,#111822,#0c131b)",
    borderRadius: 22,
    padding: 26,
    boxShadow: "0 24px 72px rgba(0,0,0,.4)",
    textAlign: "center",
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    margin: "0 auto 16px",
    background: "#1976d2",
    fontWeight: 900,
    letterSpacing: ".04em",
  },
  title: { margin: 0, fontSize: 28, letterSpacing: "-.03em" },
  subtitle: { margin: "8px 0 18px", color: "#93a4b8", fontSize: 15 },
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: 14,
    marginBottom: 20,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #536579",
    boxSizing: "border-box",
  },
  pad: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  key: {
    minHeight: 58,
    borderRadius: 14,
    border: "1px solid #2b3949",
    background: "#121b25",
    color: "#f6f8fb",
    fontSize: 21,
    fontWeight: 800,
    cursor: "pointer",
  },
  message: {
    minHeight: 20,
    marginTop: 14,
    color: "#ff6b6b",
    fontSize: 13,
    fontWeight: 700,
  },
};
