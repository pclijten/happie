"use strict";
const SIGN = "Met vriendelijke groet,\n\n[uw naam]\nHuisartsenpraktijk Aarle-Rixtel\n0492-381253";
const uid = () => "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const S = { info: null, data: null, beheer: false, tab: "brieven", cat: "Alle", q: "", sel: null, mode: "view", edit: null, confirm: "", sig: "", modal: null };
const app = document.getElementById("app");
const canEdit = () => !!(S.info && S.info.writable && S.beheer);

/* ---------- hulpjes ---------- */
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  (kids || []).forEach((c) => { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return n;
}
let toastTimer;
function toast(msg, bad) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 2500);
}
async function api(p) { const r = await p; if (!r.ok) throw new Error(r.error); return r.value; }
const fmtSize = (n) => (!n ? "" : n > 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " kB");
const cats = () => (S.data ? S.data.categories : []);
const letters = () => (S.data ? S.data.letters : []);
const catName = (id) => { const c = cats().find((x) => x.id === id); return c ? c.name : "Zonder categorie"; };
const current = () => letters().find((l) => l.id === S.sel) || null;
const errText = (e) => (e && e.message) || "onbekende fout";
const logo = () => el("div", { class: "brand" }, [el("img", { src: "logo.png", alt: "Huisartsenpraktijk Aarle-Rixtel", width: "190", height: "52" })]);
const panel = (kids) => el("div", { class: "panel" }, kids);

async function copyText(text, label) {
  try { await api(window.hap.copy(text)); toast(label + " gekopieerd"); } catch (e) { toast("Kopiëren lukt niet: " + errText(e), true); }
}
function fullPath(a) {
  if (a.kind === "link") return a.target;
  const d = S.info.dataDir, sep = d.includes("\\") ? "\\" : "/";
  return d.replace(/[\\/]+$/, "") + sep + a.rel.replace(/[\\/]/g, sep);
}

/* ---------- opstarten ---------- */
async function load() {
  const st = await api(window.hap.state());
  S.info = st;
  if (st.needFolder) { renderFolder(); return; }
  S.data = st.data || { categories: [], letters: [], settings: {} };
  if (!S.info.pinSet && S.info.writable) { /* geen pincode: beheer staat open voor wie schrijfrechten heeft */ }
  buildShell(); onData(true); protoRefresh().then(renderTop);
  setInterval(async () => { if (S.tab === "proto" && !["edit", "finish", "people"].includes(P.mode)) { const before = JSON.stringify([P.d, P.own, P.all]); await protoRefresh(); if (JSON.stringify([P.d, P.own, P.all]) !== before) { protoBar(); protoList(); renderWork(); } } }, 30000);
}

function renderFolder() {
  app.innerHTML = "";
  app.appendChild(el("div", { class: "card" }, [logo(), el("h1", { text: "Kies de gegevensmap" }),
    el("p", { text: "De brieven en bijlagen staan in een gedeelde map, bijvoorbeeld op de M-schijf. Kies die map één keer. Op een nieuwe computer kiest u dezelfde map." }),
    el("div", { class: "actions" }, [el("button", { class: "pill pill-gold", type: "button", text: "Map kiezen", onclick: async () => {
      try { if (await api(window.hap.chooseFolder())) await load(); } catch (e) { toast(errText(e), true); } } })]),
    el("p", { class: "hint", text: "Versie " + (S.info.version || "") })]));
}

/* ---------- hoofdscherm ---------- */
function buildShell() {
  app.innerHTML = "";
  app.appendChild(el("div", { class: "top" }, [el("div", { class: "wrap" }, [
    el("div", { class: "brand" }, [el("img", { src: "logo.png", alt: "Huisartsenpraktijk Aarle-Rixtel", width: "190", height: "52" }),
      el("div", { class: "brand-sep", "aria-hidden": "true" }), el("div", { class: "brand-tool" }, ["Berichtsjablonen", el("br"), "voor het portaal"])]),
    el("div", { class: "top-actions", id: "top-actions" })])]));
  app.appendChild(el("div", { id: "ro" }));
  app.appendChild(el("nav", { class: "bar", "aria-label": "Categorieën" }, [el("div", { class: "wrap", id: "bar-in" })]));
  const search = el("input", { class: "search", id: "q", type: "search", placeholder: "Zoek een brief", "aria-label": "Zoek een brief", oninput: (e) => { S.q = e.target.value; renderList(); } });
  app.appendChild(el("main", null, [el("div", { class: "wrap" }, [
    el("h1", { id: "h-main", text: "Berichtsjablonen" }),
    el("p", { class: "lead", id: "h-lead", text: "Kies een brief en kopieer de tekst als platte tekst. Het plakt zonder opmaak in eZorg, Thunderbird en het HIS. Hoort er een bijlage bij, dan opent of bewaart u die hier en voegt u hem in het portaal toe." }),
    el("div", { class: "grid" }, [
      el("aside", { class: "side", "aria-label": "Brieven" }, [search, el("ul", { class: "list", id: "list" }), el("div", { id: "side-foot" })]),
      el("section", { class: "work", id: "work" })])])]));
  app.appendChild(el("footer", null, [el("div", { class: "wrap" }, [el("span", { text: "Huisartsenpraktijk Aarle-Rixtel" }), el("span", { text: "Bosscheweg 20e, 5735 GV Aarle-Rixtel" }), el("span", { text: "0492-381253" }), el("span", { text: "Versie " + S.info.version })])]));
}

function renderTop() {
  const box = document.getElementById("top-actions"); if (!box) return;
  box.innerHTML = "";
  [["brieven", "Brieven", "tab-brieven"], ["proto", "Protocollen", "tab-proto"]].forEach(([k, t, id]) => box.appendChild(el("button", { id, class: "pill pill-sm " + (S.tab === k ? "pill-gold" : "pill-soft"), type: "button", text: t + (k === "proto" && P.me ? (() => { const n = protos().filter(needsRead).length; return n ? " (" + n + ")" : ""; })() : ""), onclick: () => setTab(k) })));
  if (canEdit() && S.tab === "brieven") {
    box.appendChild(el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Categorieën", onclick: () => { S.mode = "cats"; S.confirm = ""; renderWork(); } }));
    box.appendChild(el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Instellingen", onclick: () => { S.mode = "settings"; S.confirm = ""; renderWork(); } }));
    }
  if (canEdit()) box.appendChild(el("button", { class: "pill pill-line pill-sm", type: "button", text: "Beheer sluiten", onclick: closeBeheer }));
  else if (S.info.writable) {
    box.appendChild(el("button", { class: "pill pill-line pill-sm", type: "button", text: "Beheer", onclick: openBeheer }));
  }
  box.appendChild(el("span", { class: "who", text: P.me ? P.me.name : S.info.user }));
  const ro = document.getElementById("ro"); ro.innerHTML = "";
  if (!S.info.writable) ro.appendChild(el("div", { class: "ro" }, [el("div", { class: "wrap", text: "U hebt alleen leesrechten op de gegevensmap. Brieven kopiëren kan, wijzigen niet." })]));
}
async function openBeheer() {
  if (!S.info.pinSet || S.info.unlocked) { S.beheer = true; refresh(); return; }
  askPin();
}
async function closeBeheer() {
  S.beheer = false; S.mode = "view"; S.edit = null; S.confirm = ""; P.mode = "view"; P.edit = null; P.confirm = "";
  try { await api(window.hap.lock()); S.info.unlocked = false; } catch (e) {}
  refresh();
}
function askPin() {
  const pin = el("input", { class: "in", id: "pin", type: "password", autocomplete: "off", inputmode: "numeric", "aria-label": "Pincode" });
  const err = el("p", { class: "err", role: "alert" });
  const close = () => { const m = document.getElementById("modal"); if (m) m.remove(); };
  const form = el("form", { class: "card", onsubmit: async (ev) => {
    ev.preventDefault();
    try { if (await api(window.hap.unlock(pin.value))) { S.info.unlocked = true; S.beheer = true; close(); refresh(); } else { err.textContent = "Deze pincode klopt niet."; pin.select(); } }
    catch (e) { err.textContent = errText(e); }
  } }, [el("h1", { text: "Beheer" }), el("p", { class: "hint", text: "Voer de pincode in om brieven, categorieën en bijlagen te wijzigen." }),
    el("div", null, [el("label", { class: "lbl", for: "pin", text: "Pincode" }), pin]), err,
    el("div", { class: "actions" }, [el("button", { class: "pill pill-gold", type: "submit", text: "Openen" }), el("button", { class: "pill pill-soft", type: "button", text: "Annuleren", onclick: close })])]);
  document.body.appendChild(el("div", { class: "modal", id: "modal" }, [form])); pin.focus();
}

function renderBar() {
  if (S.tab === "proto") return protoBar();
  const box = document.getElementById("bar-in"); if (!box) return;
  box.innerHTML = "";
  [{ id: "Alle", name: "Alle" }].concat(cats()).forEach((c) => box.appendChild(el("button", { type: "button", text: c.name, "aria-pressed": String(S.cat === c.id), onclick: () => { S.cat = c.id; renderBar(); renderList(); } })));
}
function filtered() {
  const q = S.q.trim().toLowerCase();
  return letters().filter((l) => (S.cat === "Alle" || l.cat === S.cat) && (!q || ((l.title || "") + " " + (l.subject || "") + " " + (l.body || "")).toLowerCase().includes(q)));
}
function renderList() {
  if (S.tab === "proto") return protoList();
  const list = document.getElementById("list"), foot = document.getElementById("side-foot"); if (!list) return;
  list.innerHTML = ""; foot.innerHTML = "";
  const items = filtered();
  if (!items.length) list.appendChild(el("li", { class: "empty", text: letters().length ? "Geen brieven gevonden." : "Nog geen brieven." }));
  items.forEach((l) => {
    const n = (l.attachments || []).length;
    list.appendChild(el("li", null, [el("button", { class: "item", type: "button", "aria-current": String(l.id === S.sel),
      onclick: () => { if (S.mode === "edit") return toast("Sla de brief eerst op of kies Annuleren.", true); S.sel = l.id; S.mode = "view"; S.confirm = ""; renderList(); renderWork(); } }, [
      el("span", { class: "t" }, [l.title, el("small", { text: catName(l.cat) + (n ? " · " + n + (n === 1 ? " bijlage" : " bijlagen") : "") })]),
      el("span", { class: "arrow", "aria-hidden": "true", text: "→" })])]));
  });
  if (canEdit()) foot.appendChild(el("button", { class: "pill pill-sm pill-white", type: "button", text: "+ Nieuwe brief", onclick: startNew }));
}

function renderWork() {
  const w = document.getElementById("work"); if (!w) return;
  w.innerHTML = "";
  if (S.tab === "proto") return renderProtoWork(w);
  if (S.mode === "cats" && canEdit()) return renderCats(w);
  if (S.mode === "settings" && canEdit()) return renderSettings(w);
  if (S.mode === "edit" && canEdit()) return renderEdit(w);
  S.mode = "view";
  const t = current();
  if (!t) {
    w.appendChild(panel([el("h2", { text: letters().length ? "Kies een brief" : "Er zijn nog geen brieven" }),
      el("p", { class: "hint", text: letters().length ? "Selecteer links een brief om te beginnen." : "Open Beheer om de eerste brief te maken." })])); return;
  }
  renderView(w, t);
}

function attLabel(a) {
  return [a.name + " ", el("small", { text: a.size ? "(" + fmtSize(a.size) + ")" : a.kind === "link" && /^https?:/i.test(a.target) ? "(webadres)" : "" }),
    el("span", { class: "att-sub", text: a.kind === "link" ? "Gekoppeld: " + a.target : "Bijgevoegd" }), a.missing ? el("span", { class: "warn", text: "Het gekoppelde bestand is niet gevonden. Meld dit aan de beheerder." }) : null];
}
function renderView(w, t) {
  const subjectIn = el("input", { class: "in", id: "f-subject", value: t.subject || "" });
  const bodyIn = el("textarea", { class: "in", id: "f-body" }); bodyIn.value = t.body || "";
  const acts = [
    el("button", { class: "pill pill-gold", type: "button", text: "Kopieer bericht", onclick: () => copyText(bodyIn.value, "Bericht") }),
    el("button", { class: "pill pill-line", type: "button", text: "Kopieer onderwerp", onclick: () => copyText(subjectIn.value, "Onderwerp") }),
    el("button", { class: "pill pill-line", type: "button", text: "Kopieer alles", onclick: () => copyText(subjectIn.value + "\n\n" + bodyIn.value, "Onderwerp en bericht") }),
    el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Originele tekst terugzetten", onclick: () => { subjectIn.value = t.subject || ""; bodyIn.value = t.body || ""; } })
  ];
  if (canEdit()) acts.push(el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Brief bewerken", onclick: () => startEdit(t) }));
  w.appendChild(panel([
    el("div", null, [el("h2", { text: t.title }), el("span", { class: "crumb", text: catName(t.cat) })]),
    el("div", null, [el("label", { class: "lbl", for: "f-subject", text: "Onderwerp" }), subjectIn]),
    el("div", null, [el("label", { class: "lbl", for: "f-body", text: "Bericht" }), bodyIn]),
    el("p", { class: "hint", text: "Vervang na het plakken de tekst tussen [haken], bijvoorbeeld [naam]. U kunt de tekst hier eerst aanpassen. Aanpassingen worden niet bewaard." }),
    el("div", { class: "actions" }, acts)]));
  const atts = t.attachments || [];
  if (atts.length) w.appendChild(el("div", { class: "att" }, [
    el("h3", { text: atts.length === 1 ? "Bijlage bij deze brief" : "Bijlagen bij deze brief" }),
    el("p", { class: "hint", text: "Kies Openen om te controleren, of Opslaan als om het bestand op uw computer te bewaren. Voeg het daarna in het portaal toe. Met Kopieer pad plakt u het pad in het venster waarmee u een bestand kiest." })].concat(atts.map((a) =>
    el("div", { class: "att-row" }, [el("span", { class: "att-name" }, attLabel(a)),
      el("span", { class: "row" }, [
        el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Openen", onclick: async () => { try { await api(window.hap.attachOpen(a)); } catch (e) { toast(errText(e), true); } } }),
        a.kind === "file" || (a.kind === "link" && !/^https?:/i.test(a.target)) ? el("button", { class: "pill pill-line pill-sm", type: "button", text: "Opslaan als", onclick: async () => {
          try { const p = await api(window.hap.attachSaveAs(a)); if (p) toast("Opgeslagen in " + p); } catch (e) { toast(errText(e), true); } } }) : null,
        el("button", { class: "pill pill-line pill-sm", type: "button", text: "Kopieer pad", onclick: () => copyText(fullPath(a), "Pad") })])])))));
}

/* ---------- beheer: brieven ---------- */
function startNew() {
  S.edit = { id: uid(), isNew: true, title: "", cat: S.cat !== "Alle" ? S.cat : (cats()[0] ? cats()[0].id : ""), subject: "", body: "Beste [naam],\n\n\n\n" + SIGN, attachments: [], added: [], removed: [] };
  S.mode = "edit"; S.confirm = ""; renderWork(); const f = document.getElementById("e-title"); if (f) f.focus();
}
function startEdit(t) {
  S.edit = { id: t.id, isNew: false, title: t.title, cat: t.cat, subject: t.subject || "", body: t.body || "", attachments: (t.attachments || []).map((a) => ({ ...a })), added: [], removed: [] };
  S.mode = "edit"; S.confirm = ""; renderWork();
}
async function cancelEdit() {
  if (S.edit) for (const a of S.edit.added) if (a.kind === "file") await window.hap.attachRemove(a).catch(() => {});
  S.edit = null; S.mode = "view"; S.confirm = ""; renderWork();
}
const usedElsewhere = (a, except) => letters().some((l) => l.id !== except && (l.attachments || []).some((x) => x.kind === "file" && x.rel === a.rel));

function renderEdit(w) {
  const e = S.edit; if (!e) { S.mode = "view"; return renderWork(); }
  const title = el("input", { class: "in", id: "e-title", value: e.title, oninput: (x) => { e.title = x.target.value; } });
  const cat = el("select", { class: "in", id: "e-cat", onchange: (x) => { e.cat = x.target.value; } },
    cats().map((c) => { const o = el("option", { value: c.id, text: c.name }); if (c.id === e.cat) o.selected = true; return o; }));
  if (!cats().length) cat.appendChild(el("option", { value: "", text: "Maak eerst een categorie" }));
  const subj = el("input", { class: "in", id: "e-subject", value: e.subject, oninput: (x) => { e.subject = x.target.value; } });
  const body = el("textarea", { class: "in", id: "e-body", oninput: (x) => { e.body = x.target.value; } }); body.value = e.body;

  const attBox = el("div", { class: "att" });
  const paintAtt = () => {
    attBox.innerHTML = "";
    attBox.appendChild(el("h3", { text: "Bijlagen" }));
    if (!e.attachments.length) attBox.appendChild(el("p", { class: "hint", text: "Nog geen bijlagen." }));
    e.attachments.forEach((a, i) => attBox.appendChild(el("div", { class: "att-row" }, [
      el("span", { class: "att-name" }, attLabel(a)),
      el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Verwijderen", onclick: () => {
        const gone = e.attachments.splice(i, 1)[0];
        if (e.added.some((x) => x.id === gone.id)) { e.added = e.added.filter((x) => x.id !== gone.id); if (gone.kind === "file") window.hap.attachRemove(gone).catch(() => {}); }
        else e.removed.push(gone);
        paintAtt(); } })])));
    const lname = el("input", { class: "in", id: "l-name", placeholder: "Naam (mag leeg)", "aria-label": "Naam van de koppeling" });
    const ltarget = el("input", { class: "in", id: "l-target", placeholder: "M:\\Formulieren\\intake.pdf of https://...", "aria-label": "Pad of webadres" });
    attBox.appendChild(el("div", { class: "row" }, [el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Bestand bijvoegen", onclick: async () => {
      try { const a = await api(window.hap.attachFile(e.id)); if (a) { e.attachments.push(a); e.added.push(a); paintAtt(); toast("Bijgevoegd. Vergeet niet op te slaan."); } } catch (err) { toast(errText(err), true); } } }),
      el("span", { class: "hint", text: "Er komt een kopie in de gegevensmap te staan." })]));
    attBox.appendChild(el("div", null, [el("label", { class: "lbl", for: "l-target", text: "Of koppel een bestaand bestand of webadres" }),
      el("div", { class: "row" }, [lname, ltarget, el("button", { class: "pill pill-line pill-sm", type: "button", text: "Koppelen", onclick: async () => {
        try { const a = await api(window.hap.attachLink(lname.value.trim(), ltarget.value)); e.attachments.push(a); e.added.push(a); paintAtt(); toast("Gekoppeld. Vergeet niet op te slaan."); } catch (err) { toast(errText(err), true); } } })]),
      el("p", { class: "hint", text: "Een koppeling wijst naar het bestand op de plek waar het staat (bijvoorbeeld op de M-schijf). Wordt het daar verplaatst, dan werkt de koppeling niet meer. Zet geen patiëntgegevens in bijlagen." })]));
  };
  paintAtt();

  let del = null;
  if (!e.isNew) del = S.confirm === "del"
    ? el("span", { class: "row" }, [el("span", { class: "hint", text: "Weet u het zeker?" }),
        el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Ja, verwijder deze brief", onclick: deleteLetter }),
        el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Annuleren", onclick: () => { S.confirm = ""; renderWork(); } })])
    : el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Brief verwijderen", onclick: () => { S.confirm = "del"; renderWork(); } });

  w.appendChild(panel([
    el("h2", { text: e.isNew ? "Nieuwe brief" : "Brief bewerken" }),
    el("div", { class: "fields" }, [
      el("div", null, [el("label", { class: "lbl", for: "e-title", text: "Naam van de brief" }), title]),
      el("div", null, [el("label", { class: "lbl", for: "e-cat", text: "Categorie" }), cat])]),
    el("div", null, [el("label", { class: "lbl", for: "e-subject", text: "Onderwerp" }), subj]),
    el("div", null, [el("label", { class: "lbl", for: "e-body", text: "Bericht" }), body,
      el("p", { class: "hint", text: "Gebruik [haken] voor tekst die de medewerker na het plakken invult, zoals [naam]. Schrijf platte tekst zonder opmaak." })]),
    attBox,
    el("div", { class: "actions" }, [el("button", { class: "pill pill-gold", type: "button", text: "Opslaan", onclick: saveLetter }),
      el("button", { class: "pill pill-soft", type: "button", text: "Annuleren", onclick: cancelEdit }), del])]));
}
async function saveLetter() {
  const e = S.edit;
  if (!e.title.trim()) return toast("Geef de brief een naam.", true);
  if (!e.cat) return toast("Kies een categorie. Maak er eerst een aan als die nog ontbreekt.", true);
  try {
    const d = await api(window.hap.op("saveLetter", { letter: { id: e.id, title: e.title.trim(), cat: e.cat, subject: e.subject, body: e.body, attachments: e.attachments } }));
    S.data = d;
    for (const a of e.removed) if (a.kind === "file" && !usedElsewhere(a, e.id)) await window.hap.attachRemove(a).catch(() => {});
    S.sel = e.id; S.edit = null; S.mode = "view"; S.confirm = ""; toast("Opgeslagen"); renderBar(); renderList(); renderWork();
  } catch (err) { toast("Opslaan lukt niet: " + errText(err), true); }
}
async function deleteLetter() {
  const e = S.edit, files = e.attachments.concat(e.removed);
  try {
    S.data = await api(window.hap.op("deleteLetter", { id: e.id }));
    for (const a of files) if (a.kind === "file" && !usedElsewhere(a, e.id)) await window.hap.attachRemove(a).catch(() => {});
    S.edit = null; S.mode = "view"; S.sel = null; S.confirm = ""; toast("Brief verwijderd"); onData(true);
  } catch (err) { toast("Verwijderen lukt niet: " + errText(err), true); }
}

/* ---------- beheer: categorieën ---------- */
function renderCats(w) {
  const newIn = el("input", { class: "in", id: "c-new", placeholder: "Bijvoorbeeld POH, UZO of CGM", "aria-label": "Naam nieuwe categorie" });
  const run = async (type, p, msg) => { try { S.data = await api(window.hap.op(type, p)); toast(msg); onData(true); } catch (e) { toast(errText(e), true); } };
  const add = () => { const n = newIn.value.trim(); if (!n) return; run("saveCategory", { category: { id: uid(), name: n, order: Date.now() } }, "Categorie toegevoegd"); };
  newIn.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); add(); } });
  const rows = cats().map((c) => {
    const count = letters().filter((l) => l.cat === c.id).length;
    const inp = el("input", { class: "in", value: c.name, "aria-label": "Naam van categorie " + c.name });
    inp.addEventListener("change", () => { const n = inp.value.trim(); if (!n) { inp.value = c.name; return; } run("saveCategory", { category: { id: c.id, name: n } }, "Naam gewijzigd"); });
    const btn = S.confirm === "cat:" + c.id
      ? el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Ja, verwijder", onclick: () => { S.confirm = ""; if (S.cat === c.id) S.cat = "Alle"; run("deleteCategory", { id: c.id }, "Categorie verwijderd"); } })
      : el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Verwijderen", disabled: count > 0, title: count ? "Verplaats of verwijder eerst de brieven in deze categorie" : "", onclick: () => { S.confirm = "cat:" + c.id; renderWork(); } });
    return el("div", { class: "row" }, [inp, el("span", { class: "crumb", text: count + (count === 1 ? " brief" : " brieven") }), btn]);
  });
  w.appendChild(panel([el("h2", { text: "Categorieën beheren" }),
    el("p", { class: "hint", text: "Categorieën verschijnen in de gouden balk. Een categorie met brieven kunt u pas verwijderen als die brieven zijn verplaatst of verwijderd." })]
    .concat(rows.length ? rows : [el("p", { class: "hint", text: "Nog geen categorieën." })]).concat([
    el("div", null, [el("label", { class: "lbl", for: "c-new", text: "Nieuwe categorie" }), el("div", { class: "row" }, [newIn, el("button", { class: "pill pill-gold", type: "button", text: "Toevoegen", onclick: add })])]),
    el("div", { class: "actions" }, [el("button", { class: "pill pill-soft", type: "button", text: "Klaar", onclick: () => { S.mode = "view"; S.confirm = ""; renderWork(); } })])])));
}

/* ---------- beheer: instellingen ---------- */
function renderSettings(w) {
  const pin1 = el("input", { class: "in", id: "p1", type: "password", autocomplete: "new-password", "aria-label": "Nieuwe pincode", placeholder: "Nieuwe pincode (minimaal 4 tekens)" });
  const auto = el("input", { type: "checkbox", id: "auto", onchange: async (ev) => {
    try { const on = await api(window.hap.autostart(ev.target.checked)); S.info.autostart = on; toast(on ? "Het programma start voortaan met Windows" : "Automatisch starten staat uit"); } catch (e) { toast(errText(e), true); } } });
  auto.checked = !!S.info.autostart;
  w.appendChild(panel([el("h2", { text: "Instellingen" }),
    el("div", null, [el("span", { class: "lbl", text: "Gegevensmap" }), el("div", { class: "pathbox", text: S.info.dataDir }),
      el("div", { class: "actions mt" }, [el("button", { class: "pill pill-line pill-sm", type: "button", text: "Andere map kiezen", onclick: async () => {
        try { if (await api(window.hap.chooseFolder())) { S.beheer = false; S.mode = "view"; await load(); toast("Map gewijzigd"); } } catch (e) { toast(errText(e), true); } } })]),
      el("p", { class: "hint", text: "Hierin staan sjablonen.json, de map bijlagen en de dagelijkse back-ups (map back-ups). Zet de rechten op deze map in Windows: alleen beheerders mogen schrijven, medewerkers alleen lezen." })]),
    el("div", { class: "checkrow" }, [auto, el("label", { for: "auto", text: "Dit programma automatisch starten met Windows (voor deze computer)" })]),
    el("div", null, [el("span", { class: "lbl", text: "Pincode voor beheer" }),
      el("p", { class: "hint", text: S.info.pinSet ? "Er is een pincode ingesteld. Beheer vraagt erom." : "Er is geen pincode. Iedereen met schrijfrechten kan Beheer openen." }),
      el("div", { class: "row mt" }, [pin1, el("button", { class: "pill pill-gold pill-sm", type: "button", text: S.info.pinSet ? "Pincode wijzigen" : "Pincode instellen", onclick: async () => {
        try { S.data = await api(window.hap.setPin(pin1.value)); S.info.pinSet = true; S.info.unlocked = true; pin1.value = ""; toast("Pincode ingesteld"); renderWork(); } catch (e) { toast(errText(e), true); } } }),
        S.info.pinSet ? el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Pincode verwijderen", onclick: async () => {
          try { S.data = await api(window.hap.setPin("")); S.info.pinSet = false; toast("Pincode verwijderd"); renderWork(); } catch (e) { toast(errText(e), true); } } }) : null]),
      el("p", { class: "hint", text: "De pincode voorkomt dat iemand per ongeluk iets wijzigt. De echte beveiliging zijn de Windows-rechten op de gegevensmap." })]),
    el("div", { class: "actions" }, [el("button", { class: "pill pill-soft", type: "button", text: "Klaar", onclick: () => { S.mode = "view"; renderWork(); } })])]));
}

/* ---------- data bijwerken ---------- */
async function setTab(k) {
  if (S.mode === "edit" || P.mode === "edit" || P.mode === "finish") return toast("Rond eerst het openstaande formulier af.", true);
  S.tab = k; S.q = ""; { const qq = document.getElementById("q"); if (qq) qq.placeholder = k === "proto" ? "Zoek een protocol" : "Zoek een brief"; } const q = document.getElementById("q"); if (q) q.value = "";
  const h = document.getElementById("h-main"), l = document.getElementById("h-lead");
  if (k === "proto") { h.textContent = "Protocollen"; l.textContent = "Open een protocol en bevestig dat u de actuele versie hebt gelezen. De beheerder bewaakt de jaarlijkse herziening."; await protoRefresh(); }
  else { h.textContent = "Berichtsjablonen"; l.textContent = "Kies een brief en kopieer de tekst als platte tekst. Het plakt zonder opmaak in eZorg, Thunderbird en het HIS. Hoort er een bijlage bij, dan opent of bewaart u die hier en voegt u hem in het portaal toe."; }
  refresh();
}
function refresh() { renderTop(); renderBar(); renderList(); renderWork(); }
function onData(force) {
  if (!S.data) return;
  cats().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), "nl"));
  letters().sort((a, b) => String(a.title).localeCompare(String(b.title), "nl"));
  if (S.cat !== "Alle" && !cats().some((c) => c.id === S.cat)) S.cat = "Alle";
  if (S.mode === "view" && (!S.sel || !current()) && letters().length) S.sel = (filtered()[0] || letters()[0]).id;
  renderTop(); renderBar(); renderList();
  const sig = S.mode + "|" + JSON.stringify(current()) + "|" + (S.mode === "cats" ? JSON.stringify(cats()) + letters().length : "");
  if (force || sig !== S.sig) { S.sig = sig; if (S.mode !== "edit") renderWork(); }
}

window.hap.onChanged((d) => { if (d && d.categories && d.letters) { S.data = d; onData(false); } });
load().catch((e) => { app.innerHTML = ""; app.appendChild(el("div", { class: "card" }, [logo(), el("h1", { text: "Starten lukt niet" }), el("p", { text: errText(e) })])); });
