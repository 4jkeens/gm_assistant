"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let active = true;

    const verifyAccess = async (nextSession: Session | null) => {
      if (!active) return;

      if (!nextSession) {
        setSession(null);
        setAccessDenied(false);
        setChecking(false);
        return;
      }

      const { error } = await supabase
        .from("app_settings")
        .select("key")
        .eq("key", "timezone")
        .maybeSingle();

      if (!active) return;

      setSession(nextSession);
      setAccessDenied(Boolean(error));
      setChecking(false);
    };

    supabase.auth.getSession().then(({ data }) => verifyAccess(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      verifyAccess(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");

    const normalized = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message || "Sign-in failed. Please try again.");
    } else {
      setMessage("Check your email for the GM Dashboard sign-in link.");
    }
    setSending(false);
  };

  if (checking) {
    return (
      <main style={styles.shell}>
        <div style={styles.card}>
          <div style={styles.logo}>GM</div>
          <h1 style={styles.title}>GM Dashboard</h1>
          <p style={styles.muted}>Checking secure session…</p>
        </div>
      </main>
    );
  }

  if (accessDenied && session) {
    return (
      <main style={styles.shell}>
        <div style={styles.card}>
          <div style={{ ...styles.logo, background: "#6b2430" }}>!</div>
          <h1 style={styles.title}>Access denied</h1>
          <p style={styles.muted}>This account is not approved for this GM Dashboard.</p>
          <button
            style={styles.button}
            onClick={async () => {
              await supabase.auth.signOut();
              setAccessDenied(false);
              setMessage("");
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={styles.shell}>
        <form style={styles.card} onSubmit={sendMagicLink}>
          <div style={styles.logo}>GM</div>
          <h1 style={styles.title}>GM Dashboard</h1>
          <p style={styles.muted}>
            Sign in once on this device. Your session will stay saved for normal daily use.
          </p>
          <label style={styles.label}>Work email</label>
          <input
            style={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button style={styles.button} type="submit" disabled={sending}>
            {sending ? "Sending…" : "Email My Sign-In Link"}
          </button>
          {message && <p style={styles.message}>{message}</p>}
        </form>
      </main>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(circle at 50% 10%, rgba(45,156,255,.12), transparent 28rem), linear-gradient(145deg,#070b10,#0b1118)",
    color: "#f4f7fb",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: "min(440px, 94vw)",
    border: "1px solid #263241",
    background: "linear-gradient(180deg,#111822,#0c131b)",
    borderRadius: 20,
    padding: 28,
    boxShadow: "0 22px 70px rgba(0,0,0,.35)",
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    marginBottom: 18,
    background: "#1976d2",
    fontWeight: 900,
    letterSpacing: ".04em",
  },
  title: { margin: 0, fontSize: 28, letterSpacing: "-.03em" },
  muted: { color: "#8fa0b4", lineHeight: 1.5, fontSize: 14, margin: "8px 0 20px" },
  label: { display: "block", color: "#b8c6d6", fontSize: 12, marginBottom: 7 },
  input: {
    width: "100%",
    border: "1px solid #344458",
    background: "#091018",
    color: "#fff",
    borderRadius: 11,
    padding: "12px 13px",
    fontSize: 15,
    outline: "none",
    marginBottom: 11,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 11,
    padding: "12px 14px",
    background: "#1976d2",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  message: { margin: "12px 0 0", color: "#a9c9e8", fontSize: 12, lineHeight: 1.45 },
};
