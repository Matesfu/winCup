/**
 * Shared input validators — used by both Server Actions and client form components.
 * All functions return a string error message, or null if the value is valid.
 */
export const Validation = {
  // ── Auth validators ──────────────────────────────────────────────────────

  username(value: string): string | null {
    const t = value.trim();
    if (t.length < 3) return "Username must be at least 3 characters";
    if (t.length > 30) return "Username must be 30 characters or fewer";
    if (!/^[a-zA-Z0-9_]+$/.test(t))
      return "Username may only contain letters, numbers, and underscores";
    return null;
  },

  email(value: string): string | null {
    const t = value.trim();
    if (!t) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
      return "Enter a valid email address";
    return null;
  },

  password(value: string): string | null {
    if (value.length < 8) return "Password must be at least 8 characters";
    return null;
  },

  // ── Room form validators ────────────────────────────────────────────────

  hostName(value: string): string | null {
    const t = value.trim();
    if (t.length < 1) return "Display name is required";
    if (t.length > 40) return "Display name must be 40 characters or fewer";
    return null;
  },

  stakeAmount(value: string): string | null {
    if (!value || value.trim() === "") return null; // optional
    const n = Number(value);
    if (isNaN(n) || n < 0) return "Stake must be a positive number";
    return null;
  },

  countrySelection(codes: string[]): string | null {
    if (codes.length < 4)
      return `Select at least 4 countries (currently ${codes.length})`;
    if (codes.length > 36) return "Too many countries selected";
    return null;
  },

  winRule(value: string): string | null {
    if (!["strict", "last_standing"].includes(value)) return "Invalid win rule";
    return null;
  },

  // ── Join Room validator ───────────────────────────────────────────────────

  roomCode(value: string): string | null {
    // Tolerant: strip spaces, uppercase, handle "WC-XXXX", "WCXXXX", "WC XXXX", or bare "XXXX"
    const cleaned = value.trim().toUpperCase().replace(/\s/g, "");
    let suffix: string;
    if (cleaned.startsWith("WC-")) {
      suffix = cleaned.slice(3);
    } else if (cleaned.startsWith("WC") && cleaned.length > 2) {
      // Handles "WCAB23" (no dash/space separator)
      suffix = cleaned.slice(2);
    } else {
      suffix = cleaned;
    }
    if (suffix.length === 0) return "Room code is required";
    if (suffix.length !== 4) return "Room codes are 4 characters (format: WC-XXXX)";
    if (!/^[A-Z0-9]+$/.test(suffix)) return "Room code contains invalid characters";
    return null;
  },
};
