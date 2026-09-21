import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  adoptLegacyData,
  createSession,
  createUser,
  deleteExpiredSessions,
  deleteSession,
  findUserBySessionToken,
  findUserByUsername,
  type User,
} from "./db.js";

const SESSION_COOKIE = "platewise_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

/** Only a local demo fallback — a real deploy must set SESSION_SECRET. */
export const sessionSecret = process.env.SESSION_SECRET ?? "platewise-dev-only-secret";
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set — using an insecure dev fallback.");
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: User;
    }
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    signed: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

async function startSession(res: Response, userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  createSession(token, userId, expiresAt);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

function readSessionToken(req: Request): string | null {
  const token = req.signedCookies?.[SESSION_COOKIE];
  return typeof token === "string" && token.length > 0 ? token : null;
}

function getUserFromRequest(req: Request): User | undefined {
  const token = readSessionToken(req);
  if (!token) return undefined;
  return findUserBySessionToken(token);
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "not authenticated" });
  }
  req.userId = user.id;
  req.user = user;
  next();
}

interface Credentials {
  username: string;
  password: string;
}

type CredentialsResult = { ok: true; value: Credentials } | { ok: false; error: string };

function parseCredentials(body: unknown): CredentialsResult {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid body" };
  const raw = body as Record<string, unknown>;
  const username = typeof raw.username === "string" ? raw.username.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "username must be 3-32 chars: letters, digits, . _ -" };
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return { ok: false, error: `password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters` };
  }
  return { ok: true, value: { username, password } };
}

async function registerUser(username: string, password: string): Promise<User> {
  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  return createUser(username, passwordHash);
}

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const { username, password } = parsed.value;
  if (findUserByUsername(username)) {
    return res.status(409).json({ error: "username is already taken" });
  }

  try {
    const user = await registerUser(username, password);
    await startSession(res, user.id);
    res.status(201).json({ id: user.id, username: user.username });
  } catch (err) {
    console.error("Register failed", err);
    res.status(500).json({ error: "could not create account" });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = parseCredentials(req.body);
  if (!parsed.ok) return res.status(401).json({ error: "invalid username or password" });

  const { username, password } = parsed.value;
  const row = findUserByUsername(username);
  if (!row) {
    // Spend comparable time on unknown users so latency does not leak existence.
    await hash(password, BCRYPT_ROUNDS);
    return res.status(401).json({ error: "invalid username or password" });
  }

  if (!(await compare(password, row.password_hash))) {
    return res.status(401).json({ error: "invalid username or password" });
  }

  try {
    deleteExpiredSessions();
    await startSession(res, row.id);
    res.json({ id: row.id, username: row.username });
  } catch (err) {
    console.error("Login failed", err);
    res.status(500).json({ error: "could not start session" });
  }
});

authRouter.post("/logout", (req, res) => {
  const token = readSessionToken(req);
  if (token) deleteSession(token);
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

authRouter.get("/me", (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "not authenticated" });
  res.json({ id: user.id, username: user.username });
});

/**
 * Seeds the demo account so demo day does not depend on filling in a signup
 * form, and lets it inherit any pre-accounts prefs/shopping list.
 */
export async function seedDemoUser(): Promise<void> {
  const username = process.env.DEMO_USERNAME?.trim();
  const password = process.env.DEMO_PASSWORD;
  if (!username || !password) return;

  if (!USERNAME_PATTERN.test(username) || password.length < PASSWORD_MIN) {
    console.warn("DEMO_USERNAME/DEMO_PASSWORD do not meet the account rules — skipping seed.");
    return;
  }

  try {
    const existing = findUserByUsername(username);
    const userId = existing?.id ?? (await registerUser(username, password)).id;
    adoptLegacyData(userId);
    if (!existing) console.log(`Seeded demo account "${username}".`);
  } catch (err) {
    console.error("Demo user seeding failed", err);
  }
}
