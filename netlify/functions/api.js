// Lab Compliance Portal — unified API (Netlify Functions v2 + Netlify Blobs)
import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_DAYS = 7;
const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB per document

// ---------- helpers ----------
const store = () => getStore("portal");

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(":");
    const candidate = scryptSync(password, salt, 64);
    return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function sessionCookie(token, maxAgeSeconds) {
  return (
    `plc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  );
}

function getCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

async function currentUser(req) {
  const token = getCookie(req, "plc_session");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = store();
  const session = await s.get(`session:${token}`, { type: "json" });
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    await s.delete(`session:${token}`);
    return null;
  }
  const user = await s.get(`user:${session.email}`, { type: "json" });
  return user ? { ...user, _token: token } : null;
}

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, _token, ...rest } = u;
  return rest;
}

const emailKey = (email) => String(email).trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- assessment scoring ----------
// answer values: 2 = yes, 1 = partial, 0 = no
function computeScores(answers, categories) {
  const catScores = {};
  let totalEarned = 0;
  let totalPossible = 0;
  for (const cat of categories) {
    let earned = 0;
    let possible = 0;
    for (const q of cat.questions) {
      const v = answers[q.id];
      possible += 2;
      if (v === 2 || v === 1) earned += v;
    }
    catScores[cat.id] = possible ? Math.round((earned / possible) * 100) : 0;
    totalEarned += earned;
    totalPossible += possible;
  }
  return {
    overall: totalPossible ? Math.round((totalEarned / totalPossible) * 100) : 0,
    categories: catScores,
  };
}

// Category/question definitions are mirrored on the frontend (src/data/assessment.js)
const CATEGORIES = [
  { id: "regulatory", name: "Regulatory (CLIA)", questions: [
    { id: "reg1" }, { id: "reg2" }, { id: "reg3" }, { id: "reg4" }, { id: "reg5" },
  ]},
  { id: "personnel", name: "Personnel & training", questions: [
    { id: "per1" }, { id: "per2" }, { id: "per3" }, { id: "per4" },
  ]},
  { id: "sops", name: "SOPs & documentation", questions: [
    { id: "sop1" }, { id: "sop2" }, { id: "sop3" }, { id: "sop4" },
  ]},
  { id: "equipment", name: "Equipment & validation", questions: [
    { id: "eq1" }, { id: "eq2" }, { id: "eq3" }, { id: "eq4" },
  ]},
  { id: "qc", name: "Quality control & testing", questions: [
    { id: "qc1" }, { id: "qc2" }, { id: "qc3" }, { id: "qc4" },
  ]},
  { id: "safety", name: "Safety & compliance", questions: [
    { id: "saf1" }, { id: "saf2" }, { id: "saf3" }, { id: "saf4" },
  ]},
];

// ---------- route handlers ----------
async function handleRegister(req) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { email, password, firstName, lastName, phone, businessName, businessAddress, labType } = body || {};

  if (!email || !EMAIL_RE.test(email)) return json({ error: "Valid email is required" }, 400);
  if (!password || password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
  if (!firstName || !lastName || !businessName || !labType) return json({ error: "Please fill in all required fields" }, 400);

  const s = store();
  const key = `user:${emailKey(email)}`;
  const existing = await s.get(key, { type: "json" });
  if (existing) return json({ error: "An account with this email already exists" }, 409);

  // First registered account becomes the admin
  const { blobs } = await s.list({ prefix: "user:" });
  const isFirst = blobs.length === 0;

  const user = {
    email: emailKey(email),
    firstName: String(firstName).slice(0, 100),
    lastName: String(lastName).slice(0, 100),
    phone: String(phone || "").slice(0, 40),
    businessName: String(businessName).slice(0, 200),
    businessAddress: String(businessAddress || "").slice(0, 300),
    labType: String(labType).slice(0, 50),
    role: isFirst ? "admin" : "client",
    status: "New",
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };
  await s.setJSON(key, user);

  // create session
  const token = randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 3600;
  await s.setJSON(`session:${token}`, {
    email: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge * 1000,
  });
  return json({ user: publicUser(user) }, 201, { "Set-Cookie": sessionCookie(token, maxAge) });
}

async function handleLogin(req) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { email, password } = body || {};
  if (!email || !password) return json({ error: "Email and password are required" }, 400);

  const s = store();
  const user = await s.get(`user:${emailKey(email)}`, { type: "json" });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return json({ error: "Invalid email or password" }, 401);
  }
  const token = randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 3600;
  await s.setJSON(`session:${token}`, {
    email: user.email,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge * 1000,
  });
  return json({ user: publicUser(user) }, 200, { "Set-Cookie": sessionCookie(token, maxAge) });
}

async function handleLogout(req) {
  const token = getCookie(req, "plc_session");
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await store().delete(`session:${token}`);
  }
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
}

async function handleAssessmentGet(user) {
  const data = await store().get(`assessment:${user.email}`, { type: "json" });
  return json({ assessment: data || null });
}

async function handleAssessmentPut(req, user) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") return json({ error: "answers object required" }, 400);
  const clean = {};
  for (const [k, v] of Object.entries(answers)) {
    if (/^[a-z]{2,4}\d$/.test(k) && [0, 1, 2].includes(v)) clean[k] = v;
  }
  const scores = computeScores(clean, CATEGORIES);
  const record = { answers: clean, scores, updatedAt: new Date().toISOString() };
  await store().setJSON(`assessment:${user.email}`, record);
  return json({ assessment: record });
}

async function handleDocList(user, email) {
  const s = store();
  const { blobs } = await s.list({ prefix: `doc:${email}:` });
  const docs = [];
  for (const b of blobs) {
    const meta = await s.get(b.key, { type: "json" });
    if (meta) docs.push(meta);
  }
  docs.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  return json({ documents: docs });
}

async function handleDocUpload(req, user) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { name, category, contentType, dataBase64 } = body || {};
  if (!name || !dataBase64) return json({ error: "name and dataBase64 are required" }, 400);
  let buf;
  try { buf = Buffer.from(dataBase64, "base64"); } catch { return json({ error: "Invalid file data" }, 400); }
  if (buf.length === 0) return json({ error: "Empty file" }, 400);
  if (buf.length > MAX_DOC_BYTES) return json({ error: "File exceeds 5 MB limit" }, 413);

  const id = randomBytes(8).toString("hex");
  const meta = {
    id,
    name: String(name).slice(0, 200),
    category: String(category || "General").slice(0, 60),
    contentType: String(contentType || "application/octet-stream").slice(0, 100),
    size: buf.length,
    uploadedAt: new Date().toISOString(),
    owner: user.email,
  };
  const s = store();
  await s.set(`docfile:${user.email}:${id}`, buf);
  await s.setJSON(`doc:${user.email}:${id}`, meta);
  return json({ document: meta }, 201);
}

async function handleDocDownload(email, id) {
  const s = store();
  const meta = await s.get(`doc:${email}:${id}`, { type: "json" });
  if (!meta) return json({ error: "Not found" }, 404);
  const buf = await s.get(`docfile:${email}:${id}`, { type: "arrayBuffer" });
  if (!buf) return json({ error: "Not found" }, 404);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": meta.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${meta.name.replace(/"/g, "")}"`,
    },
  });
}

async function handleDocDelete(email, id) {
  const s = store();
  await s.delete(`doc:${email}:${id}`);
  await s.delete(`docfile:${email}:${id}`);
  return json({ ok: true });
}

async function handleAdminClients() {
  const s = store();
  const { blobs } = await s.list({ prefix: "user:" });
  const clients = [];
  for (const b of blobs) {
    const u = await s.get(b.key, { type: "json" });
    if (!u) continue;
    const assessment = await s.get(`assessment:${u.email}`, { type: "json" });
    const { blobs: docBlobs } = await s.list({ prefix: `doc:${u.email}:` });
    clients.push({
      ...publicUser(u),
      readiness: assessment ? assessment.scores.overall : null,
      documentCount: docBlobs.length,
    });
  }
  clients.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ clients });
}

async function handleAdminClientDetail(email) {
  const s = store();
  const u = await s.get(`user:${email}`, { type: "json" });
  if (!u) return json({ error: "Client not found" }, 404);
  const assessment = await s.get(`assessment:${email}`, { type: "json" });
  const { blobs } = await s.list({ prefix: `doc:${email}:` });
  const documents = [];
  for (const b of blobs) {
    const meta = await s.get(b.key, { type: "json" });
    if (meta) documents.push(meta);
  }
  documents.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  return json({ client: publicUser(u), assessment: assessment || null, documents });
}

const ALLOWED_STATUSES = ["New", "Onboarding", "In Review", "Inspection Ready", "On Hold"];

async function handleAdminClientPatch(req, email) {
  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const s = store();
  const u = await s.get(`user:${email}`, { type: "json" });
  if (!u) return json({ error: "Client not found" }, 404);
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return json({ error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` }, 400);
    }
    u.status = body.status;
  }
  await s.setJSON(`user:${email}`, u);
  return json({ client: publicUser(u) });
}

function handleCheckoutStub() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return json({
      error: "Payments are not configured yet. Add STRIPE_SECRET_KEY in Netlify environment variables to enable checkout.",
      configured: false,
    }, 501);
  }
  return json({ error: "Checkout implementation pending Stripe key setup", configured: true }, 501);
}

// ---------- router ----------
export default async function handler(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();

  try {
    // public routes
    if (path === "/api/register" && method === "POST") return await handleRegister(req);
    if (path === "/api/login" && method === "POST") return await handleLogin(req);
    if (path === "/api/logout" && method === "POST") return await handleLogout(req);

    if (path === "/api/me" && method === "GET") {
      const user = await currentUser(req);
      return json({ user: publicUser(user) });
    }

    // authenticated routes
    const user = await currentUser(req);
    if (!user) return json({ error: "Not signed in" }, 401);

    if (path === "/api/assessment") {
      if (method === "GET") return await handleAssessmentGet(user);
      if (method === "PUT") return await handleAssessmentPut(req, user);
    }

    if (path === "/api/documents" && method === "GET") return await handleDocList(user, user.email);
    if (path === "/api/documents" && method === "POST") return await handleDocUpload(req, user);

    let m = path.match(/^\/api\/documents\/([a-f0-9]{16})\/download$/);
    if (m && method === "GET") return await handleDocDownload(user.email, m[1]);
    m = path.match(/^\/api\/documents\/([a-f0-9]{16})$/);
    if (m && method === "DELETE") return await handleDocDelete(user.email, m[1]);

    if (path === "/api/checkout" && method === "POST") return handleCheckoutStub();

    // admin routes
    if (path.startsWith("/api/admin/")) {
      if (user.role !== "admin") return json({ error: "Admin access required" }, 403);

      if (path === "/api/admin/clients" && method === "GET") return await handleAdminClients();

      m = path.match(/^\/api\/admin\/clients\/([^/]+)$/);
      if (m) {
        const email = decodeURIComponent(m[1]).toLowerCase();
        if (method === "GET") return await handleAdminClientDetail(email);
        if (method === "PATCH") return await handleAdminClientPatch(req, email);
      }

      m = path.match(/^\/api\/admin\/clients\/([^/]+)\/documents\/([a-f0-9]{16})\/download$/);
      if (m && method === "GET") {
        return await handleDocDownload(decodeURIComponent(m[1]).toLowerCase(), m[2]);
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("API error:", err);
    return json({ error: "Server error. Please try again." }, 500);
  }
}

export const config = { path: "/api/*" };
