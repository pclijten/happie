// Hoofdproces: leest en schrijft de gegevensmap (bijvoorbeeld op de M-schijf) en doet alles met bestanden.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu } = require("electron");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { DEFAULT_CATS, DEFAULT_LETTERS } = require("./defaults");

const PORTABLE_EXE = process.env.PORTABLE_EXECUTABLE_FILE || "";
const MAX_FILE = 50 * 1024 * 1024;
let win = null;
let dataDir = null;
let unlocked = false;

/* ---------- instellingen per computer ---------- */
const configFile = () => path.join(app.getPath("userData"), "config.json");
function readConfig() { try { return JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch (e) { return {}; } }
function writeConfig(c) { fs.mkdirSync(path.dirname(configFile()), { recursive: true }); fs.writeFileSync(configFile(), JSON.stringify(c, null, 2)); }

function resolveDataDir() {
  const arg = process.argv.find((a) => a.startsWith("--data="));
  if (process.env.HAP_DATA_DIR) return process.env.HAP_DATA_DIR;
  if (arg) return arg.slice(7);
  const cfg = readConfig();
  if (cfg.dataDir && fs.existsSync(cfg.dataDir)) return cfg.dataDir;
  if (PORTABLE_EXE) {
    const next = path.join(path.dirname(PORTABLE_EXE), "Gegevens");
    if (fs.existsSync(next)) return next;
  }
  return null;
}

const identity = () => { try { return os.userInfo().username + "@" + os.hostname(); } catch (e) { return "onbekend"; } };
const dataFile = () => path.join(dataDir, "sjablonen.json");
const lockFile = () => path.join(dataDir, "sjablonen.lock");
const attDir = () => path.join(dataDir, "bijlagen");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isWritable() {
  try { await fsp.access(dataDir, fs.constants.W_OK); const t = path.join(dataDir, ".schrijftest-" + process.pid); await fsp.writeFile(t, "x"); await fsp.unlink(t); return true; }
  catch (e) { return false; }
}

/* ---------- gegevens lezen en schrijven ---------- */
function emptyData() {
  return {
    schema: 1, revision: 1, savedAt: new Date().toISOString(), savedBy: identity(), settings: {},
    categories: DEFAULT_CATS.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    letters: DEFAULT_LETTERS.map((l) => ({ id: l.id, cat: l.cat, title: l.title, subject: l.subject, body: l.body, attachments: [], updatedAt: new Date().toISOString(), updatedBy: identity() }))
  };
}
async function readData() {
  try { return JSON.parse(await fsp.readFile(dataFile(), "utf8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
async function withLock(fn, lp) {
  lp = lp || lockFile();
  let have = false;
  for (let i = 0; i < 60 && !have; i++) {
    try { const fh = await fsp.open(lp, "wx"); await fh.close(); have = true; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { const st = await fsp.stat(lp); if (Date.now() - st.mtimeMs > 15000) await fsp.unlink(lp); } catch (x) {}
      await sleep(100);
    }
  }
  if (!have) throw new Error("De gegevens worden nu door iemand anders bijgewerkt. Probeer het over een paar seconden opnieuw.");
  try { return await fn(); } finally { try { await fsp.unlink(lp); } catch (e) {} }
}
async function backupOncePerDay(current, prefix) {
  prefix = prefix || "sjablonen";
  const dir = path.join(dataDir, "back-ups");
  await fsp.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(dir, prefix + "-" + stamp + ".json");
  try { await fsp.access(target); } catch (e) { await fsp.writeFile(target, JSON.stringify(current, null, 2)); }
  const files = (await fsp.readdir(dir)).filter((f) => f.startsWith(prefix + "-")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 60))) { try { await fsp.unlink(path.join(dir, f)); } catch (e) {} }
}
async function mutate(fn) {
  if (!(await isWritable())) throw new Error("U hebt geen schrijfrechten op de gegevensmap.");
  return withLock(async () => {
    const cur = (await readData()) || emptyData();
    if (cur.revision) await backupOncePerDay(cur);
    const next = JSON.parse(JSON.stringify(cur));
    await fn(next);
    next.revision = (cur.revision || 0) + 1; next.savedAt = new Date().toISOString(); next.savedBy = identity();
    const tmp = dataFile() + ".tmp-" + process.pid;
    await fsp.writeFile(tmp, JSON.stringify(next, null, 2));
    await fsp.rename(tmp, dataFile());
    return next;
  });
}

/* ---------- PIN (alleen tegen per ongeluk wijzigen) ---------- */
function hashPin(pin, salt) { return crypto.scryptSync(String(pin), salt, 32).toString("hex"); }
const pinIsSet = (d) => !!(d && d.settings && d.settings.pinHash);
function pinOk(d, pin) {
  if (!pinIsSet(d)) return true;
  const a = Buffer.from(hashPin(pin, d.settings.pinSalt), "hex"), b = Buffer.from(d.settings.pinHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function requireAdmin() {
  const d = await readData();
  if (pinIsSet(d) && !unlocked) throw new Error("Beheer is vergrendeld. Voer de pincode in.");
}

/* ---------- bijlagen ---------- */
const safeName = (n) => String(n).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 120) || "bestand";
function insideAtt(p) { const r = path.resolve(p), base = path.resolve(attDir()); return r === base || r.startsWith(base + path.sep); }
function absOf(att) {
  if (att.kind === "file") { const p = path.resolve(dataDir, att.rel); if (!insideAtt(p)) throw new Error("Ongeldig pad."); return p; }
  return att.target;
}
const isUrl = (t) => /^https?:\/\//i.test(t);

/* ---------- venster ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 880, minWidth: 760, minHeight: 560, backgroundColor: "#ffffff", autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"), title: "HAP Berichtsjablonen",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

function startWatching() {
  if (!dataDir) return;
  fs.watchFile(dataFile(), { interval: 3000 }, async () => {
    try { const d = await readData(); if (d && win && !win.isDestroyed()) win.webContents.send("data-changed", d); } catch (e) {}
  });
}

/* ---------- koppeling met het scherm ---------- */
const wrap = (fn) => async (_e, ...args) => { try { return { ok: true, value: await fn(...args) }; } catch (err) { return { ok: false, error: err.message || String(err) }; } };

ipcMain.handle("state", wrap(async () => {
  if (!dataDir) return { needFolder: true, version: app.getVersion() };
  const writable = await isWritable();
  let d = await readData();
  if (!d && writable) d = await mutate(() => {});
  return { dataDir, writable, data: d, pinSet: pinIsSet(d), unlocked, user: identity(), version: app.getVersion(),
    autostart: app.getLoginItemSettings({ path: PORTABLE_EXE || process.execPath }).openAtLogin };
}));

ipcMain.handle("choose-folder", wrap(async () => {
  const r = await dialog.showOpenDialog(win, { title: "Kies de gegevensmap (bijvoorbeeld op de M-schijf)", properties: ["openDirectory", "createDirectory"] });
  if (r.canceled || !r.filePaths[0]) return false;
  const cfg = readConfig(); cfg.dataDir = r.filePaths[0]; writeConfig(cfg);
  dataDir = cfg.dataDir; fs.unwatchFile(dataFile()); startWatching(); return true;
}));

ipcMain.handle("unlock", wrap(async (pin) => { const d = await readData(); if (!pinOk(d, pin)) return false; unlocked = true; return true; }));
ipcMain.handle("lock", wrap(async () => { unlocked = false; return true; }));
ipcMain.handle("set-pin", wrap(async (pin) => {
  await requireAdmin();
  return mutate((d) => {
    d.settings = d.settings || {};
    if (!pin) { delete d.settings.pinHash; delete d.settings.pinSalt; unlocked = false; return; }
    if (String(pin).length < 4) throw new Error("Kies een pincode van minimaal 4 tekens.");
    const salt = crypto.randomBytes(16).toString("hex");
    d.settings.pinSalt = salt; d.settings.pinHash = hashPin(pin, salt); unlocked = true;
  });
}));

ipcMain.handle("op", wrap(async (type, p) => {
  await requireAdmin();
  const now = new Date().toISOString(), who = identity();
  return mutate((d) => {
    if (type === "saveLetter") {
      const l = p.letter, i = d.letters.findIndex((x) => x.id === l.id);
      const rec = { id: l.id, cat: l.cat, title: l.title, subject: l.subject, body: l.body, attachments: l.attachments || [], updatedAt: now, updatedBy: who };
      if (i >= 0) d.letters[i] = rec; else d.letters.push(rec);
    } else if (type === "deleteLetter") {
      d.letters = d.letters.filter((x) => x.id !== p.id);
    } else if (type === "saveCategory") {
      const c = p.category, i = d.categories.findIndex((x) => x.id === c.id);
      if (i >= 0) d.categories[i] = { ...d.categories[i], ...c }; else d.categories.push(c);
    } else if (type === "deleteCategory") {
      if (d.letters.some((l) => l.cat === p.id)) throw new Error("Deze categorie bevat nog brieven.");
      d.categories = d.categories.filter((x) => x.id !== p.id);
    } else throw new Error("Onbekende bewerking.");
  });
}));

ipcMain.handle("attach-file", wrap(async (letterId) => {
  await requireAdmin();
  const r = await dialog.showOpenDialog(win, { title: "Kies een bijlage", properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  const src = r.filePaths[0], st = await fsp.stat(src);
  if (st.size > MAX_FILE) throw new Error("Dit bestand is groter dan 50 MB.");
  const id = crypto.randomBytes(6).toString("hex"), name = safeName(path.basename(src));
  const rel = path.join("bijlagen", String(letterId).replace(/[^\w-]/g, "_"), id + "-" + name);
  const dest = path.join(dataDir, rel);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest);
  return { id, kind: "file", name, size: st.size, rel };
}));

ipcMain.handle("attach-link", wrap(async (name, target) => {
  await requireAdmin();
  const t = String(target || "").trim().replace(/^"|"$/g, "");
  if (!t) throw new Error("Vul een pad of webadres in.");
  const id = crypto.randomBytes(6).toString("hex");
  if (isUrl(t)) return { id, kind: "link", name: name || t, size: 0, target: t };
  let size = 0, exists = true;
  try { size = (await fsp.stat(t)).size; } catch (e) { exists = false; }
  return { id, kind: "link", name: name || path.basename(t), size, target: t, missing: !exists };
}));

ipcMain.handle("attach-remove", wrap(async (att) => {
  await requireAdmin();
  if (att.kind === "file") { const p = absOf(att); try { await fsp.unlink(p); } catch (e) {} }
  return true;
}));

ipcMain.handle("attach-open", wrap(async (att) => {
  if (att.kind === "link" && isUrl(att.target)) { await shell.openExternal(att.target); return true; }
  const p = absOf(att), err = await shell.openPath(p);
  if (err) throw new Error("Openen lukt niet: " + err);
  return true;
}));

ipcMain.handle("attach-save-as", wrap(async (att) => {
  if (att.kind === "link" && isUrl(att.target)) throw new Error("Een webadres kunt u niet opslaan. Gebruik Openen.");
  const src = absOf(att);
  const r = await dialog.showSaveDialog(win, { title: "Bijlage opslaan als", defaultPath: path.join(app.getPath("downloads"), att.name) });
  if (r.canceled || !r.filePath) return false;
  await fsp.copyFile(src, r.filePath);
  return r.filePath;
}));

ipcMain.handle("clipboard", wrap(async (text) => { clipboard.writeText(String(text)); return true; }));
ipcMain.handle("autostart", wrap(async (on) => {
  app.setLoginItemSettings({ openAtLogin: !!on, path: PORTABLE_EXE || process.execPath });
  return app.getLoginItemSettings({ path: PORTABLE_EXE || process.execPath }).openAtLogin;
}));

/* ================= PROTOCOLLEN ================= */
const protoFile = () => path.join(dataDir, "protocollen.json");
const protoLock = () => path.join(dataDir, "protocollen.lock");
const readsDir = () => path.join(dataDir, "leesbewijzen");
const archiveDir = () => path.join(dataDir, "protocol-archief");
const winUser = () => { try { return os.userInfo().username; } catch (e) { return ""; } };
const emptyProto = () => ({ schema: 1, revision: 1, savedAt: new Date().toISOString(), savedBy: identity(), people: [], protocols: [] });
async function readProto() {
  try { return JSON.parse(await fsp.readFile(protoFile(), "utf8")); }
  catch (e) { if (e.code === "ENOENT") return null; throw e; }
}
async function mutateProto(fn) {
  if (!(await isWritable())) throw new Error("U hebt geen schrijfrechten op de gegevensmap.");
  return withLock(async () => {
    const cur = (await readProto()) || emptyProto();
    await backupOncePerDay(cur, "protocollen");
    const next = JSON.parse(JSON.stringify(cur));
    await fn(next);
    next.revision = (cur.revision || 0) + 1; next.savedAt = new Date().toISOString(); next.savedBy = identity();
    const tmp = protoFile() + ".tmp-" + process.pid;
    await fsp.writeFile(tmp, JSON.stringify(next, null, 2));
    await fsp.rename(tmp, protoFile());
    return next;
  }, protoLock());
}
const meOf = (p) => { const w = winUser().toLowerCase(); return (p && p.people || []).find((x) => String(x.win || "").toLowerCase() === w) || null; };
const whoName = (p) => { const m = meOf(p); return m ? m.name : identity(); };
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function addMonths(iso, n) {
  const d = new Date(iso + "T00:00:00"); d.setMonth(d.getMonth() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function bumpVersion(v, big) {
  const m = String(v || "1.0").match(/^(\d+)\.(\d+)$/); const maj = m ? +m[1] : 1, min = m ? +m[2] : 0;
  return big ? (maj + 1) + ".0" : maj + "." + (min + 1);
}
const readsFileOf = (user) => path.join(readsDir(), String(user).toLowerCase().replace(/[^\w.-]/g, "_") + ".json");
async function readReads(user) { try { return JSON.parse(await fsp.readFile(readsFileOf(user), "utf8")); } catch (e) { return { user: String(user).toLowerCase(), reads: [] }; } }
async function readAllReads() {
  let files = []; try { files = await fsp.readdir(readsDir()); } catch (e) { return []; }
  const out = [];
  for (const f of files) if (f.endsWith(".json")) { try { out.push(JSON.parse(await fsp.readFile(path.join(readsDir(), f), "utf8"))); } catch (e) {} }
  return out;
}
const fileExists = async (t) => { if (!t || isUrl(t)) return !!t; try { await fsp.access(t); return true; } catch (e) { return false; } };
const logEntry = (p, action, extra) => ({ at: new Date().toISOString(), by: whoName(p), action, ...(extra || {}) });

ipcMain.handle("proto-state", wrap(async () => {
  if (!dataDir) throw new Error("Geen gegevensmap gekozen.");
  const p = (await readProto()) || emptyProto();
  const protocols = await Promise.all(p.protocols.map(async (pr) => ({ ...pr, missing: !(await fileExists(pr.target)) })));
  const own = await readReads(winUser());
  const all = (await isWritable()) ? await readAllReads() : [];
  return { data: { ...p, protocols }, me: meOf(p), winUser: winUser(), own: own.reads || [], all };
}));

ipcMain.handle("proto-op", wrap(async (type, a) => {
  await requireAdmin();
  return mutateProto((d) => {
    if (type === "savePerson") {
      const x = a.person; if (!x.name || !x.win) throw new Error("Naam en Windows-account zijn verplicht.");
      const dup = d.people.find((q) => q.id !== x.id && String(q.win).toLowerCase() === String(x.win).toLowerCase());
      if (dup) throw new Error("Dit Windows-account hoort al bij " + dup.name + ".");
      const i = d.people.findIndex((q) => q.id === x.id); const rec = { id: x.id, name: x.name.trim(), initials: (x.initials || "").trim(), win: x.win.trim() };
      if (i >= 0) d.people[i] = rec; else d.people.push(rec);
    } else if (type === "deletePerson") {
      d.people = d.people.filter((q) => q.id !== a.id);
    } else if (type === "saveProtocol") {
      const x = a.protocol; if (!x.title || !x.target) throw new Error("Titel en bestand zijn verplicht.");
      const i = d.protocols.findIndex((q) => q.id === x.id);
      const base = { id: x.id, code: x.code || "", title: x.title.trim(), theme: (x.theme || "Overig").trim(), owner: x.owner || "", target: x.target.trim().replace(/^"|"$/g, ""),
        status: x.status || "geldig", version: x.version || "1.0", approvedAt: x.approvedAt || todayIso(), reviewDue: x.reviewDue || addMonths(x.approvedAt || todayIso(), 12) };
      if (i >= 0) { d.protocols[i] = { ...d.protocols[i], ...base }; d.protocols[i].log = (d.protocols[i].log || []).concat(logEntry(d, "Gegevens gewijzigd", { version: base.version })); }
      else d.protocols.push({ ...base, lastReviewed: base.approvedAt, checkout: null, log: [logEntry(d, "Toegevoegd aan het register", { version: base.version })] });
    } else if (type === "deleteProtocol") {
      const pr = d.protocols.find((q) => q.id === a.id);
      if (pr && pr.checkout) throw new Error("Dit protocol wordt bewerkt. Rond dat eerst af.");
      d.protocols = d.protocols.filter((q) => q.id !== a.id);
    } else if (type === "review") {
      const pr = d.protocols.find((q) => q.id === a.id); if (!pr) throw new Error("Protocol niet gevonden.");
      pr.lastReviewed = todayIso(); pr.reviewDue = addMonths(todayIso(), 12);
      pr.log = (pr.log || []).concat(logEntry(d, "Herzien, geen wijziging", { version: pr.version, note: a.note || "" }));
    } else throw new Error("Onbekende bewerking.");
  });
}));

ipcMain.handle("proto-pick-file", wrap(async () => {
  const r = await dialog.showOpenDialog(win, { title: "Kies het protocolbestand", properties: ["openFile"],
    filters: [{ name: "Documenten", extensions: ["docx", "doc", "pdf", "xlsx", "xls"] }, { name: "Alle bestanden", extensions: ["*"] }] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
}));

async function openTarget(t) {
  if (isUrl(t)) { await shell.openExternal(t); return true; }
  const err = await shell.openPath(t);
  if (err) throw new Error("Openen lukt niet: " + err);
  return true;
}
ipcMain.handle("proto-open", wrap(async (id) => {
  const p = await readProto(); const pr = p && p.protocols.find((q) => q.id === id);
  if (!pr) throw new Error("Protocol niet gevonden.");
  return openTarget(pr.target);
}));

ipcMain.handle("proto-confirm", wrap(async (id) => {
  const p = await readProto(); const pr = p && p.protocols.find((q) => q.id === id);
  if (!pr) throw new Error("Protocol niet gevonden.");
  const me = meOf(p); if (!me) throw new Error("Uw Windows-account (" + winUser() + ") is nog niet gekoppeld aan een naam. Vraag de beheerder.");
  const f = await readReads(winUser());
  f.user = winUser().toLowerCase(); f.name = me.name; f.reads = f.reads || [];
  if (!f.reads.some((r) => r.pid === id && r.version === pr.version)) f.reads.push({ pid: id, version: pr.version, at: new Date().toISOString() });
  await fsp.mkdir(readsDir(), { recursive: true });
  const tmp = readsFileOf(winUser()) + ".tmp-" + process.pid;
  await fsp.writeFile(tmp, JSON.stringify(f, null, 2)); await fsp.rename(tmp, readsFileOf(winUser()));
  return f.reads;
}));

const wordLockPresent = async (target) => {
  if (isUrl(target)) return false;
  try { const base = path.basename(target); return (await fsp.readdir(path.dirname(target))).some((f) => f.startsWith("~$") && f.endsWith(base.slice(2)) && base.length > 2); }
  catch (e) { return false; }
};

ipcMain.handle("proto-edit-start", wrap(async (id) => {
  await requireAdmin();
  let target = null;
  await mutateProto(async (d) => {
    const pr = d.protocols.find((q) => q.id === id); if (!pr) throw new Error("Protocol niet gevonden.");
    if (isUrl(pr.target)) throw new Error("Een webadres kunt u niet bewerken.");
    target = pr.target;
    if (pr.checkout && String(pr.checkout.win).toLowerCase() !== winUser().toLowerCase())
      throw new Error("Dit protocol wordt al bewerkt door " + pr.checkout.by + " (sinds " + pr.checkout.at.slice(0, 16).replace("T", " ") + ").");
    if (pr.checkout) return;
    const st = await fsp.stat(pr.target);
    const rel = path.join("protocol-archief", String(id).replace(/[^\w-]/g, "_"), "v" + pr.version + "_" + safeName(path.basename(pr.target)));
    const dest = path.join(dataDir, rel);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try { await fsp.access(dest); } catch (e) { await fsp.copyFile(pr.target, dest); }
    pr.checkout = { by: whoName(d), win: winUser(), at: new Date().toISOString(), mtime: st.mtimeMs, archive: rel };
    pr.log = (pr.log || []).concat(logEntry(d, "Bewerken gestart", { version: pr.version }));
  });
  await openTarget(target);
  return true;
}));

ipcMain.handle("proto-edit-finish", wrap(async (id, o) => {
  await requireAdmin();
  return mutateProto(async (d) => {
    const pr = d.protocols.find((q) => q.id === id); if (!pr || !pr.checkout) throw new Error("Dit protocol is niet in bewerking.");
    if (await wordLockPresent(pr.target)) throw new Error("Het document staat nog open in Word. Sluit het eerst en probeer opnieuw.");
    const st = await fsp.stat(pr.target);
    if (st.mtimeMs === pr.checkout.mtime && !o.force) throw new Error("Het bestand lijkt niet gewijzigd. Sla het op in Word, of vink aan dat u het toch wilt vastleggen.");
    const nv = bumpVersion(pr.version, o.big);
    pr.log = (pr.log || []).concat(logEntry(d, "Nieuwe versie", { version: nv, from: pr.version, note: o.note || "" }));
    pr.version = nv; pr.approvedAt = todayIso(); pr.lastReviewed = todayIso(); pr.reviewDue = addMonths(todayIso(), 12); pr.checkout = null;
  });
}));

ipcMain.handle("proto-edit-cancel", wrap(async (id, o) => {
  await requireAdmin();
  return mutateProto(async (d) => {
    const pr = d.protocols.find((q) => q.id === id); if (!pr || !pr.checkout) throw new Error("Dit protocol is niet in bewerking.");
    if (o && o.restore) {
      if (await wordLockPresent(pr.target)) throw new Error("Het document staat nog open in Word. Sluit het eerst.");
      await fsp.copyFile(path.join(dataDir, pr.checkout.archive), pr.target);
    }
    pr.log = (pr.log || []).concat(logEntry(d, o && o.restore ? "Bewerken afgebroken, vorige versie teruggezet" : "Bewerken afgebroken", { version: pr.version }));
    pr.checkout = null;
  });
}));

/* ---------- opstarten ---------- */
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { dataDir = resolveDataDir(); createWindow(); startWatching(); });
  app.on("window-all-closed", () => app.quit());
}
