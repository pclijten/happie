"use strict";
/* Protocollen: register, leesregistratie, jaarlijkse herziening, bewerken met versies. Gebruikt de hulpjes uit app.js. */
const P = { d: null, me: null, winUser: "", own: [], all: [], sel: null, mode: "view", edit: null, theme: "Alle", confirm: "", loaded: false, err: "", fin: { big: false, note: "", force: false } };

const isoToday = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const daysTo = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(isoToday() + "T00:00:00")) / 86400000);
const fmtDate = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("-") : "-");
const fmtDT = (iso) => (iso ? fmtDate(iso) + " " + iso.slice(11, 16) : "-");
const protos = () => (P.d ? P.d.protocols : []);
const people = () => (P.d ? P.d.people : []);
const pcur = () => protos().find((x) => x.id === P.sel) || null;
const readOf = (pr) => P.own.find((r) => r.pid === pr.id && r.version === pr.version) || null;
function reviewState(pr) {
  if (!pr.reviewDue || pr.status === "ingetrokken") return "none";
  const d = daysTo(pr.reviewDue); return d < 0 ? "late" : d <= 60 ? "soon" : "ok";
}
const reviewText = (pr) => { const s = reviewState(pr), d = pr.reviewDue ? daysTo(pr.reviewDue) : 0;
  return s === "late" ? "Herziening was " + fmtDate(pr.reviewDue) + " (" + (-d) + " dagen te laat)" : s === "soon" ? "Herziening binnenkort: " + fmtDate(pr.reviewDue) : fmtDate(pr.reviewDue); };
const needsRead = (pr) => !!P.me && pr.status === "geldig" && !readOf(pr);
function readersOf(pr) {
  const done = [], todo = [];
  people().forEach((p) => {
    const f = P.all.find((x) => String(x.user).toLowerCase() === String(p.win).toLowerCase());
    const r = f && (f.reads || []).find((x) => x.pid === pr.id && x.version === pr.version);
    (r ? done : todo).push(r ? { p, at: r.at } : { p });
  });
  return { done, todo };
}

async function protoRefresh() {
  try { const r = await api(window.hap.protoState()); P.d = r.data; P.me = r.me; P.winUser = r.winUser; P.own = r.own; P.all = r.all; P.loaded = true; P.err = ""; }
  catch (e) { P.err = errText(e); }
  const t = document.getElementById("tab-proto");
  if (t) { const n = protos().filter(needsRead).length; t.textContent = "Protocollen" + (n ? " (" + n + ")" : ""); }
}

/* ---------- balk en lijst ---------- */
function protoBar() {
  const box = document.getElementById("bar-in"); box.innerHTML = "";
  const themes = [...new Set(protos().map((p) => p.theme))].sort((a, b) => a.localeCompare(b, "nl"));
  ["Alle"].concat(themes).forEach((t) => box.appendChild(el("button", { type: "button", text: t, "aria-pressed": String(P.theme === t), onclick: () => { P.theme = t; protoBar(); protoList(); } })));
}
function protoFiltered() {
  const q = S.q.trim().toLowerCase();
  return protos().filter((p) => (canEdit() || p.status !== "ingetrokken") && (P.theme === "Alle" || p.theme === P.theme)
    && (!q || (p.title + " " + p.code + " " + p.theme).toLowerCase().includes(q)));
}
function protoList() {
  const list = document.getElementById("list"), foot = document.getElementById("side-foot"); list.innerHTML = ""; foot.innerHTML = "";
  const items = protoFiltered().sort((a, b) => a.title.localeCompare(b.title, "nl"));
  if (!items.length) list.appendChild(el("li", { class: "empty", text: protos().length ? "Geen protocollen gevonden." : "Nog geen protocollen." }));
  items.forEach((p) => {
    const bits = [p.theme, "v" + p.version];
    if (p.status !== "geldig") bits.push(p.status);
    else if (needsRead(p)) bits.push("nog te lezen");
    if (reviewState(p) === "late") bits.push("herziening te laat");
    list.appendChild(el("li", null, [el("button", { class: "item", type: "button", "aria-current": String(p.id === P.sel),
      onclick: () => { if (P.mode === "edit" || P.mode === "finish") return toast("Rond eerst het openstaande formulier af.", true); P.sel = p.id; P.mode = "view"; P.confirm = ""; protoList(); renderWork(); } }, [
      el("span", { class: "t" }, [p.title, el("small", { text: bits.join(" · ") })]), el("span", { class: "arrow", "aria-hidden": "true", text: "→" })])]));
  });
  foot.appendChild(el("button", { class: "pill pill-sm pill-white", type: "button", text: "Overzicht", onclick: () => { P.sel = null; P.mode = "view"; protoList(); renderWork(); } }));
  if (canEdit()) {
    foot.appendChild(el("button", { class: "pill pill-sm pill-white", type: "button", text: "+ Nieuw protocol", onclick: protoNew }));
    foot.appendChild(el("button", { class: "pill pill-sm pill-white", type: "button", text: "Personen", onclick: () => { P.mode = "people"; renderWork(); } }));
  }
}

/* ---------- werkvlak ---------- */
function renderProtoWork(w) {
  if (P.err) { w.appendChild(panel([el("h2", { text: "Protocollen laden lukt niet" }), el("p", { class: "warn", text: P.err }), el("button", { class: "pill pill-gold", type: "button", text: "Opnieuw proberen", onclick: async () => { await protoRefresh(); protoBar(); protoList(); renderWork(); } })])); return; }
  if (!P.loaded) { w.appendChild(panel([el("h2", { text: "Laden" })])); return; }
  if (P.mode === "people" && canEdit()) return renderPeople(w);
  if (P.mode === "edit" && canEdit()) return renderProtoEdit(w);
  const pr = pcur();
  if (!pr) return renderOverview(w);
  if (P.mode === "finish" && canEdit()) return renderFinish(w, pr);
  renderProtoView(w, pr);
}

function meNotice() {
  if (P.me) return null;
  return el("p", { class: "warn", text: "Uw Windows-account (" + P.winUser + ") is nog niet gekoppeld aan een naam. U kunt protocollen openen, maar niet als gelezen registreren. Vraag de beheerder om u toe te voegen onder Personen." });
}
function renderOverview(w) {
  const kids = [el("h2", { text: "Overzicht" })];
  if (P.me) kids.push(el("p", { class: "hint", text: "Ingelogd als " + P.me.name + (P.me.initials ? " (" + P.me.initials + ")" : "") + "." }));
  const n = meNotice(); if (n) kids.push(n);
  const unread = protos().filter(needsRead);
  kids.push(el("h3", { text: "Nog te lezen door u" }));
  if (!P.me) kids.push(el("p", { class: "hint", text: "Niet beschikbaar zonder koppeling." }));
  else if (!unread.length) kids.push(el("p", { class: "okmsg", text: "U hebt alle geldige protocollen gelezen." }));
  unread.forEach((p) => kids.push(el("div", { class: "row" }, [el("span", { class: "att-name", text: p.title + " (v" + p.version + ")" }),
    el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Bekijken", onclick: () => { P.sel = p.id; protoList(); renderWork(); } })])));
  if (canEdit()) {
    const due = protos().filter((p) => ["late", "soon"].includes(reviewState(p))).sort((a, b) => a.reviewDue.localeCompare(b.reviewDue));
    kids.push(el("h3", { text: "Herziening nodig" }));
    if (!due.length) kids.push(el("p", { class: "hint", text: "Geen protocollen die binnen 60 dagen herzien moeten worden." }));
    due.forEach((p) => kids.push(el("div", { class: "row" }, [el("span", { class: "att-name" }, [p.title + " ", el("small", { class: reviewState(p) === "late" ? "warn" : "", text: reviewText(p) })]),
      el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Openen", onclick: () => { P.sel = p.id; protoList(); renderWork(); } })])));
    kids.push(el("div", { class: "actions" }, [el("button", { class: "pill pill-line", type: "button", text: "Kopieer auditoverzicht (voor Excel)", onclick: () => copyText(auditTsv(), "Overzicht") })]));
  }
  w.appendChild(panel(kids));
}
function auditTsv() {
  const rows = [["Code", "Titel", "Thema", "Eigenaar", "Versie", "Status", "Vastgesteld", "Laatst herzien", "Volgende herziening", "Gelezen door", "Nog niet gelezen door"]];
  protos().forEach((p) => { const r = readersOf(p);
    rows.push([p.code, p.title, p.theme, p.owner, p.version, p.status, fmtDate(p.approvedAt), fmtDate(p.lastReviewed), fmtDate(p.reviewDue),
      r.done.length + " van " + people().length, r.todo.map((x) => x.p.name).join(", ")]); });
  return rows.map((r) => r.map((c) => String(c == null ? "" : c).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
}

function renderProtoView(w, pr) {
  const rs = reviewState(pr), rd = readOf(pr);
  const row = (k, v, cls) => el("div", { class: "row" }, [el("span", { class: "lbl", text: k }), el("span", { class: cls || "", text: v })]);
  const kids = [
    el("div", null, [el("h2", { text: pr.title }), el("span", { class: "crumb", text: [pr.code, pr.theme, pr.owner ? "eigenaar: " + pr.owner : ""].filter(Boolean).join(" · ") })]),
    row("Versie", pr.version + " (" + pr.status + ")"),
    row("Vastgesteld", fmtDate(pr.approvedAt)),
    row("Laatst herzien", fmtDate(pr.lastReviewed)),
    row("Volgende herziening", reviewText(pr), rs === "late" ? "warn" : rs === "soon" ? "warn" : "")];
  if (pr.missing) kids.push(el("p", { class: "warn", text: "Het bestand is niet gevonden op " + pr.target + ". Meld dit aan de beheerder." }));
  if (pr.checkout) kids.push(el("p", { class: "warn", text: "Wordt bewerkt door " + pr.checkout.by + " sinds " + fmtDT(pr.checkout.at) + ". De tekst kan tijdelijk afwijken van de geldige versie." }));
  const n = meNotice(); if (n) kids.push(n);
  const acts = [el("button", { class: "pill pill-gold", type: "button", text: "Protocol openen", onclick: async () => { try { await api(window.hap.protoOpen(pr.id)); } catch (e) { toast(errText(e), true); } } })];
  if (needsRead(pr)) acts.push(el("button", { class: "pill pill-line", type: "button", text: "Ik heb versie " + pr.version + " gelezen", onclick: async () => {
    try { P.own = await api(window.hap.protoConfirm(pr.id)); toast("Vastgelegd"); await protoRefresh(); protoList(); renderWork(); } catch (e) { toast(errText(e), true); } } }));
  kids.push(el("div", { class: "actions" }, acts));
  if (rd) kids.push(el("p", { class: "okmsg", text: "U hebt versie " + pr.version + " gelezen op " + fmtDT(rd.at) + "." }));
  else if (P.me && pr.status !== "geldig") kids.push(el("p", { class: "hint", text: "Dit protocol heeft status " + pr.status + ". Lezen hoeft niet te worden vastgelegd." }));
  w.appendChild(panel(kids));

  if (canEdit()) {
    const co = pr.checkout, mine = co && String(co.win).toLowerCase() === String(P.winUser).toLowerCase();
    const a = [];
    if (!co) a.push(el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Bewerken in Word", onclick: async () => {
      try { await api(window.hap.protoEditStart(pr.id)); toast("Geopend in Word. Kies hierna Klaar met bewerken."); await protoRefresh(); renderWork(); } catch (e) { toast(errText(e), true); } } }));
    else {
      if (mine) a.push(el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Opnieuw openen", onclick: async () => { try { await api(window.hap.protoEditStart(pr.id)); } catch (e) { toast(errText(e), true); } } }));
      if (mine) a.push(el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Klaar met bewerken", onclick: () => { P.fin = { big: false, note: "", force: false }; P.mode = "finish"; renderWork(); } }));
      a.push(el("button", { class: "pill pill-danger pill-sm", type: "button", text: P.confirm === "cancel" ? "Ja, afbreken en vorige versie terugzetten" : "Bewerken afbreken", onclick: async () => {
        if (P.confirm !== "cancel") { P.confirm = "cancel"; renderWork(); return; }
        try { await api(window.hap.protoEditCancel(pr.id, { restore: true })); P.confirm = ""; toast("Afgebroken, vorige versie teruggezet"); await protoRefresh(); renderWork(); } catch (e) { toast(errText(e), true); } } }));
    }
    a.push(el("button", { class: "pill pill-line pill-sm", type: "button", text: "Herzien, geen wijziging", disabled: !!co, onclick: async () => {
      try { await api(window.hap.protoOp("review", { id: pr.id })); toast("Herziening vastgelegd"); await protoRefresh(); protoList(); renderWork(); } catch (e) { toast(errText(e), true); } } }));
    a.push(el("button", { class: "pill pill-soft pill-sm", type: "button", text: "Gegevens wijzigen", onclick: () => { P.edit = { ...pr, isNew: false }; P.mode = "edit"; renderWork(); } }));
    w.appendChild(el("div", { class: "att" }, [el("h3", { text: "Beheer" }), el("div", { class: "actions" }, a),
      el("p", { class: "hint", text: "Bewerken in Word: het programma bewaart eerst een kopie van de huidige versie, opent het originele bestand en legt na afloop de nieuwe versie vast. Klaar met bewerken kan pas als Word is gesloten." })]));

    const r = readersOf(pr);
    w.appendChild(el("div", { class: "att" }, [el("h3", { text: "Gelezen (versie " + pr.version + "): " + r.done.length + " van " + people().length }),
      ...r.done.map((x) => el("div", { class: "att-row" }, [el("span", { class: "att-name", text: x.p.name }), el("span", { class: "hint", text: fmtDT(x.at) })])),
      ...r.todo.map((x) => el("div", { class: "att-row" }, [el("span", { class: "att-name", text: x.p.name }), el("span", { class: "warn", text: "nog niet gelezen" })])),
      !people().length ? el("p", { class: "hint", text: "Nog geen personen. Voeg ze toe onder Personen." }) : null]));
  }
  const log = (pr.log || []).slice().reverse();
  if (log.length) w.appendChild(el("div", { class: "att" }, [el("h3", { text: "Wijzigingslog" })].concat(log.map((l) =>
    el("div", { class: "att-row" }, [el("span", { class: "att-name" }, [l.action + (l.from ? " (v" + l.from + " naar v" + l.version + ")" : l.version ? " (v" + l.version + ")" : ""), el("span", { class: "att-sub", text: [l.by, l.note].filter(Boolean).join(" - ") })]),
      el("span", { class: "hint", text: fmtDT(l.at) })])))));
}

function renderFinish(w, pr) {
  const note = el("textarea", { class: "in", id: "f-note", oninput: (x) => { P.fin.note = x.target.value; } }); note.value = P.fin.note; note.rows = 4;
  w.appendChild(panel([el("h2", { text: "Klaar met bewerken: " + pr.title }),
    el("p", { class: "hint", text: "Huidige versie " + pr.version + ". Sluit het document in Word voordat u dit vastlegt." }),
    el("div", { class: "checkrow" }, [el("input", { type: "radio", name: "big", id: "b0", checked: !P.fin.big, onchange: () => { P.fin.big = false; } }), el("label", { for: "b0", text: "Kleine wijziging: wordt versie " + bumpV(pr.version, false) })]),
    el("div", { class: "checkrow" }, [el("input", { type: "radio", name: "big", id: "b1", checked: P.fin.big, onchange: () => { P.fin.big = true; } }), el("label", { for: "b1", text: "Grote wijziging: wordt versie " + bumpV(pr.version, true) })]),
    el("div", null, [el("label", { class: "lbl", for: "f-note", text: "Wat is er gewijzigd?" }), note]),
    el("div", { class: "checkrow" }, [el("input", { type: "checkbox", id: "force", onchange: (x) => { P.fin.force = x.target.checked; } }), el("label", { for: "force", text: "Toch vastleggen als het bestand niet gewijzigd lijkt" })]),
    el("p", { class: "hint", text: "Na het vastleggen wordt de herzieningsdatum een jaar vooruit gezet en moet iedereen de nieuwe versie opnieuw als gelezen aanmerken." }),
    el("div", { class: "actions" }, [el("button", { class: "pill pill-gold", type: "button", text: "Nieuwe versie vastleggen", onclick: async () => {
      try { await api(window.hap.protoEditFinish(pr.id, { big: P.fin.big, note: P.fin.note.trim(), force: P.fin.force })); toast("Versie vastgelegd"); P.mode = "view"; await protoRefresh(); protoList(); renderWork(); }
      catch (e) { toast(errText(e), true); } } }),
      el("button", { class: "pill pill-soft", type: "button", text: "Terug", onclick: () => { P.mode = "view"; renderWork(); } })])]));
}
function bumpV(v, big) { const m = String(v).match(/^(\d+)\.(\d+)$/); const a = m ? +m[1] : 1, b = m ? +m[2] : 0; return big ? (a + 1) + ".0" : a + "." + (b + 1); }

/* ---------- beheer: protocol toevoegen of wijzigen ---------- */
function protoNew() {
  P.edit = { id: uid(), isNew: true, code: "", title: "", theme: P.theme !== "Alle" ? P.theme : "", owner: P.me ? P.me.name : "", target: "", status: "geldig", version: "1.0", approvedAt: isoToday(), reviewDue: "" };
  P.mode = "edit"; renderWork();
}
function renderProtoEdit(w) {
  const e = P.edit; if (!e) { P.mode = "view"; return renderWork(); }
  const inp = (id, key, extra) => el("input", { class: "in", id, value: e[key] || "", oninput: (x) => { e[key] = x.target.value; }, ...(extra || {}) });
  const themes = [...new Set(protos().map((p) => p.theme))];
  const dl = el("datalist", { id: "themes" }, themes.map((t) => el("option", { value: t })));
  const owner = el("select", { class: "in", id: "p-owner", onchange: (x) => { e.owner = x.target.value; } }, [el("option", { value: "", text: "-" })].concat(people().map((p) => { const o = el("option", { value: p.name, text: p.name }); if (p.name === e.owner) o.selected = true; return o; })));
  const status = el("select", { class: "in", id: "p-status", onchange: (x) => { e.status = x.target.value; } }, ["geldig", "concept", "ingetrokken"].map((s) => { const o = el("option", { value: s, text: s }); if (s === e.status) o.selected = true; return o; }));
  const target = inp("p-target", "target", { placeholder: "M:\\Praktijk\\01 Protocollen\\...docx" });
  w.appendChild(panel([el("h2", { text: e.isNew ? "Nieuw protocol" : "Protocol: gegevens wijzigen" }), dl,
    el("div", { class: "fields" }, [el("div", null, [el("label", { class: "lbl", for: "p-title", text: "Titel" }), inp("p-title", "title")]),
      el("div", null, [el("label", { class: "lbl", for: "p-code", text: "Code (mag leeg)" }), inp("p-code", "code")]),
      el("div", null, [el("label", { class: "lbl", for: "p-theme", text: "Thema" }), inp("p-theme", "theme", { list: "themes" })]),
      el("div", null, [el("label", { class: "lbl", for: "p-owner", text: "Eigenaar" }), owner])]),
    el("div", null, [el("label", { class: "lbl", for: "p-target", text: "Het originele bestand (Word) of webadres" }),
      el("div", { class: "row" }, [target, el("button", { class: "pill pill-line pill-sm", type: "button", text: "Bestand kiezen", onclick: async () => {
        try { const p = await api(window.hap.protoPick()); if (p) { e.target = p; target.value = p; } } catch (err) { toast(errText(err), true); } } })]),
      el("p", { class: "hint", text: "Het programma wijst naar dit bestand en bewerkt het ter plekke. Verplaats het later niet buiten dit programma om." })]),
    el("div", { class: "fields" }, [el("div", null, [el("label", { class: "lbl", for: "p-version", text: "Versie" }), inp("p-version", "version")]),
      el("div", null, [el("label", { class: "lbl", for: "p-status", text: "Status" }), status]),
      el("div", null, [el("label", { class: "lbl", for: "p-appr", text: "Vastgesteld op" }), inp("p-appr", "approvedAt", { type: "date" })]),
      el("div", null, [el("label", { class: "lbl", for: "p-due", text: "Volgende herziening (leeg = 12 maanden)" }), inp("p-due", "reviewDue", { type: "date" })])]),
    el("div", { class: "actions" }, [el("button", { class: "pill pill-gold", type: "button", text: "Opslaan", onclick: async () => {
      if (!e.title.trim() || !e.target.trim()) return toast("Vul een titel en het bestand in.", true);
      if (!/^\d+\.\d+$/.test(e.version.trim())) return toast("Versie bijvoorbeeld 1.0 of 2.3.", true);
      try { const { isNew, missing, ...rec } = e; rec.version = rec.version.trim();
        await api(window.hap.protoOp("saveProtocol", { protocol: rec })); await protoRefresh(); P.sel = e.id; P.edit = null; P.mode = "view"; toast("Opgeslagen"); protoBar(); protoList(); renderWork(); }
      catch (err) { toast(errText(err), true); } } }),
      el("button", { class: "pill pill-soft", type: "button", text: "Annuleren", onclick: () => { P.edit = null; P.mode = "view"; renderWork(); } }),
      !e.isNew ? (P.confirm === "delp" ? el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Ja, haal uit het register (bestand blijft staan)", onclick: async () => {
        try { await api(window.hap.protoOp("deleteProtocol", { id: e.id })); await protoRefresh(); P.sel = null; P.edit = null; P.mode = "view"; P.confirm = ""; protoBar(); protoList(); renderWork(); } catch (err) { toast(errText(err), true); } } })
        : el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Uit register halen", onclick: () => { P.confirm = "delp"; renderWork(); } })) : null])]));
}

/* ---------- beheer: personen ---------- */
function renderPeople(w) {
  const run = async (type, a, msg) => { try { await api(window.hap.protoOp(type, a)); await protoRefresh(); toast(msg); renderWork(); } catch (e) { toast(errText(e), true); } };
  const rows = people().map((p) => {
    const f = (key, label, wide) => { const i = el("input", { class: "in", value: p[key] || "", "aria-label": label + " van " + p.name }); if (!wide) i.size = 8;
      i.addEventListener("change", () => { const v = i.value.trim(); if (!v && key !== "initials") { i.value = p[key]; return; } run("savePerson", { person: { ...p, [key]: v } }, "Opgeslagen"); }); return i; };
    return el("div", { class: "row" }, [f("name", "Naam", true), f("initials", "Initialen"), f("win", "Windows-account", true),
      el("button", { class: "pill pill-danger pill-sm", type: "button", text: "Verwijderen", onclick: () => run("deletePerson", { id: p.id }, "Verwijderd") })]);
  });
  const n = el("input", { class: "in", id: "n-name", placeholder: "Naam" }), i = el("input", { class: "in", id: "n-ini", placeholder: "Initialen" }), win = el("input", { class: "in", id: "n-win", placeholder: "Windows-account" });
  w.appendChild(panel([el("h2", { text: "Personen" }),
    el("p", { class: "hint", text: "Iedereen werkt op een eigen Windows-account. Hier koppelt u dat account aan een naam. Het programma herkent medewerkers daaraan en legt vast wie welke versie van een protocol heeft gelezen. Het Windows-account ziet u in Verkenner onder C:\\Gebruikers\\..., of vraagt u de medewerker." })]
    .concat(rows.length ? [el("div", { class: "row" }, [el("span", { class: "lbl", text: "Naam, initialen, Windows-account" })])].concat(rows) : [el("p", { class: "hint", text: "Nog niemand toegevoegd." })])
    .concat([el("div", null, [el("label", { class: "lbl", for: "n-name", text: "Persoon toevoegen" }), el("div", { class: "row" }, [n, i, win,
      el("button", { class: "pill pill-line pill-sm", type: "button", text: "Dit ben ik (" + P.winUser + ")", onclick: () => { win.value = P.winUser; } }),
      el("button", { class: "pill pill-gold pill-sm", type: "button", text: "Toevoegen", onclick: () => {
        if (!n.value.trim() || !win.value.trim()) return toast("Vul een naam en Windows-account in.", true);
        run("savePerson", { person: { id: uid(), name: n.value, initials: i.value, win: win.value } }, "Toegevoegd"); } })])]),
      el("div", { class: "actions" }, [el("button", { class: "pill pill-soft", type: "button", text: "Klaar", onclick: () => { P.mode = "view"; renderWork(); } })])])));
}
