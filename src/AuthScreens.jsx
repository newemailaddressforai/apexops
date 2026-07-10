import { useState } from "react";
import { supabase } from "./supabaseClient";

const ACCENT = "#D4FF3D";
const INK = "#111111";

// Shown while checking session, loading data after login, or on a fatal load error.
export function FullScreenStatus({ message, isError }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#000000", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <img src="/logo-badge.png" alt="ApexOps" style={{ width: 65, height: 65, borderRadius: 12, marginBottom: 14 }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1C2333", marginBottom: 10 }}>ApexOps</div>
        <div style={{ fontSize: 14, color: isError ? "#DC2626" : "#5C6B82", lineHeight: 1.5 }}>{message}</div>
      </div>
    </div>
  );
}

// Email/password sign in. Team members are added manually in Supabase → Authentication → Users,
// so there's no self-signup here by design — only people you've explicitly added can log in.
export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (signInError) setError(signInError.message === "Invalid login credentials" ? "Incorrect email or password." : signInError.message);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A", fontFamily: "'Inter',system-ui,sans-serif", colorScheme: "light" }}>
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #1C2333 !important;
          -webkit-box-shadow: 0 0 0 1000px #F8FAFC inset !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
          <div style={{ width: 380, maxWidth: "92vw", background: "#ffffff", borderRadius: 16, padding: 36, boxShadow: "0 4px 24px #1C233318" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <img src="/logo-badge.png" alt="ApexOps" style={{ width: 96, height: 96, borderRadius: 20, marginBottom: 16 }} />
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#1C2333", marginBottom: 4 }}>ApexOps</div>
                  <div style={{ fontSize: 13, color: "#5C6B82" }}>Sign in to your account</div>
              </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5C6B82", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(""); }} placeholder="you@apexengineering.com.au" autoFocus
              style={{ width: "100%", border: "1.5px solid #D1D9E4", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "#F8FAFC", color: "#1C2333", colorScheme: "light" }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#5C6B82", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); if (error) setError(""); }} placeholder="••••••••"
              style={{ width: "100%", border: "1.5px solid #D1D9E4", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", background: "#F8FAFC", color: "#1C2333", colorScheme: "light" }} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: "100%", marginTop: 10, padding: "11px 0", background: ACCENT, color: INK, border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 20, lineHeight: 1.5 }}>
          Don't have an account? Ask your admin to add you in Supabase → Authentication → Users.
        </div>
      </div>
    </div>
  );
}
