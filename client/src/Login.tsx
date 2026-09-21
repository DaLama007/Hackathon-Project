import { useState } from "react";

export interface AuthUser {
  id: number;
  username: string;
}

type Mode = "login" | "register";

// Auth copy lives here rather than in App's shared `copy` map so the login
// screen stays self-contained.
const authCopy = {
  en: {
    loginTitle: "Log in",
    registerTitle: "Create an account",
    loginBlurb: "Your preferences and shopping list are saved to your account.",
    registerBlurb: "Pick a username and password — your list is saved automatically.",
    username: "Username",
    password: "Password",
    loginAction: "Log in",
    registerAction: "Sign up",
    working: "One moment…",
    toRegister: "No account yet? Sign up",
    toLogin: "Already have an account? Log in",
    usernameRule: "3-32 characters: letters, digits, . _ -",
    passwordRule: "At least 8 characters",
    genericError: "Something went wrong. Try again.",
  },
  nl: {
    loginTitle: "Inloggen",
    registerTitle: "Account aanmaken",
    loginBlurb: "Je voorkeuren en boodschappenlijst worden bij je account opgeslagen.",
    registerBlurb: "Kies een gebruikersnaam en wachtwoord — je lijst wordt automatisch bewaard.",
    username: "Gebruikersnaam",
    password: "Wachtwoord",
    loginAction: "Inloggen",
    registerAction: "Registreren",
    working: "Een moment…",
    toRegister: "Nog geen account? Registreer",
    toLogin: "Heb je al een account? Log in",
    usernameRule: "3-32 tekens: letters, cijfers, . _ -",
    passwordRule: "Minimaal 8 tekens",
    genericError: "Er ging iets mis. Probeer het opnieuw.",
  },
} as const;

interface LoginProps {
  lang: "en" | "nl";
  onAuthenticated: (user: AuthUser) => void;
}

export default function Login({ lang, onAuthenticated }: LoginProps) {
  const t = authCopy[lang];
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? t.genericError);
        return;
      }
      setPassword("");
      onAuthenticated((await res.json()) as AuthUser);
    } catch (err) {
      console.error("Auth request failed", err);
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <section className="auth-card">
      <h2>{isRegister ? t.registerTitle : t.loginTitle}</h2>
      <p className="hint auth-blurb">{isRegister ? t.registerBlurb : t.loginBlurb}</p>

      <form className="auth-form" onSubmit={submit}>
        <label className="auth-field">
          <span>{t.username}</span>
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          {isRegister && <small className="meta">{t.usernameRule}</small>}
        </label>

        <label className="auth-field">
          <span>{t.password}</span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
          {isRegister && <small className="meta">{t.passwordRule}</small>}
        </label>

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? t.working : isRegister ? t.registerAction : t.loginAction}
        </button>
      </form>

      <button
        type="button"
        className="ghost auth-switch"
        onClick={() => switchMode(isRegister ? "login" : "register")}
      >
        {isRegister ? t.toLogin : t.toRegister}
      </button>
    </section>
  );
}
