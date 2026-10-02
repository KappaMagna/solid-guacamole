import { firebaseConfig, nomi } from "./config.js";

// ─── Categorie ────────────────────────────────────────────────
const CATEGORIE = [
  { id: "secco",    nome: "Crocchette", em: "🥣", colore: "#ffb703" },
  { id: "umido",    nome: "Umido",      em: "🐟", colore: "#3ab0ff" },
  { id: "snack",    nome: "Snack",      em: "🍗", colore: "#ff5d8f" },
  { id: "lettiera", nome: "Lettiera",   em: "🪣", colore: "#d8b47a" },
  { id: "salute",   nome: "Salute",     em: "💊", colore: "#4cd97b" },
  { id: "giochi",   nome: "Giochi",     em: "🧶", colore: "#9b5de5" },
  { id: "altro",    nome: "Altro",      em: "📦", colore: "#b8b8b8" },
];
const CAT = Object.fromEntries(CATEGORIE.map((c) => [c.id, c]));
const cat = (id) => CAT[id] || CAT.altro;

// ─── Utilità ──────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const euroTondo = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmt = (n) => euro.format(n || 0);
const fmtBreve = (n) => (Math.abs(n) >= 1000 ? euroTondo.format(n) : euro.format(n || 0));
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_LUNGHI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const oggi = () => iso(new Date());
const giorniTra = (a, b) => Math.round((daIso(b) - daIso(a)) / 86400000) + 1; // inclusivo
const aggiungiGiorni = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return iso(d); };
const inizioMese = (y, m) => iso(new Date(y, m, 1));
const fineMese = (y, m) => iso(new Date(y, m + 1, 0));
const dataBella = (s) => { const d = daIso(s); return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`; };
const dataCorta = (s) => { const d = daIso(s); return `${d.getDate()} ${MESI[d.getMonth()]}`; };
const leggiImporto = (s) => {
  const pulito = String(s).trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(pulito);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const memoria = {
  get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* niente */ } },
};

let tempoToast;
function toast(msg, errore = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("errore-t", errore);
  t.classList.add("mostra");
  clearTimeout(tempoToast);
  tempoToast = setTimeout(() => t.classList.remove("mostra"), errore ? 4000 : 2200);
}

// ─── Archivio: Firebase oppure locale (modalità prova) ────────
const CHIAVE_PROVA = "pimpi-oberon-spese";

function archivioLocale() {
  const ascoltatori = new Set();
  const leggi = () => memoria.get(CHIAVE_PROVA, []);
  const scrivi = (lista) => { memoria.set(CHIAVE_PROVA, lista); ascoltatori.forEach((cb) => cb(leggi())); };
  return {
    modo: "prova",
    utente: null,
    ascolta(cb) { ascoltatori.add(cb); cb(leggi()); return () => ascoltatori.delete(cb); },
    async aggiungi(v) { scrivi([...leggi(), { ...v, id: crypto.randomUUID?.() || String(Date.now() + Math.random()), autore: "tu" }]); },
    async modifica(id, v) { scrivi(leggi().map((x) => (x.id === id ? { ...x, ...v } : x))); },
    async elimina(id) { scrivi(leggi().filter((x) => x.id !== id)); },
    sostituisci(lista) { scrivi(lista); },
  };
}

async function archivioFirebase() {
  const V = "10.12.2";
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch {
    db = F.getFirestore(app);
  }
  const col = F.collection(db, "spese");
  const arch = {
    modo: "cloud",
    utente: null,
    ascolta(cb, errore) {
      return F.onSnapshot(
        F.query(col, F.orderBy("data", "desc")),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        errore,
      );
    },
    // Con la cache offline la promessa si risolve solo quando il server conferma:
    // non la aspettiamo, così l'app resta veloce anche senza rete.
    aggiungi(v) {
      return F.addDoc(col, { ...v, autore: arch.utente.email, autoreNome: arch.utente.displayName || "", creato: F.serverTimestamp() });
    },
    modifica(id, v) { return F.updateDoc(F.doc(db, "spese", id), { ...v, modificatoDa: arch.utente.email, modificato: F.serverTimestamp() }); },
    async impostaNome(nome) { await A.updateProfile(arch.utente, { displayName: nome }); },
    elimina(id) { return F.deleteDoc(F.doc(db, "spese", id)); },
    entra(email, pw) { return A.signInWithEmailAndPassword(auth, email, pw); },
    esci() { return A.signOut(auth); },
    onUtente(cb) { A.onAuthStateChanged(auth, (u) => { arch.utente = u; cb(u); }); },
  };
  return arch;
}

const nomeAutore = (s) => {
  if (s.autoreNome) return s.autoreNome;
  if (!s.autore || s.autore === "tu") return "";
  return String(s.autore).split("@")[0];
};

// ─── Stato ────────────────────────────────────────────────────
const stato = {
  spese: [],
  vista: "riepilogo",
  periodo: memoria.get("pimpi-periodo", { tipo: "mese" }),
  inModifica: null,
  categoria: "secco",
  filtroCat: "",
};
let archivio;
let smetti = null;

// ─── Periodi ──────────────────────────────────────────────────
const PERIODI = [
  { tipo: "mese", nome: "Questo mese" },
  { tipo: "scorso", nome: "Mese scorso" },
  { tipo: "3mesi", nome: "3 mesi" },
  { tipo: "6mesi", nome: "6 mesi" },
  { tipo: "anno", nome: "Quest'anno" },
  { tipo: "12mesi", nome: "12 mesi" },
  { tipo: "tutto", nome: "Sempre" },
  { tipo: "custom", nome: "📅 Scegli…" },
];

function intervallo(p) {
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth();
  const mesiFa = (k) => {
    const da = inizioMese(y, m - k + 1), a = fineMese(y, m);
    return { da, a, prec: { da: inizioMese(y, m - 2 * k + 1), a: fineMese(y, m - k) } };
  };
  switch (p.tipo) {
    case "mese": return { da: inizioMese(y, m), a: fineMese(y, m), prec: { da: inizioMese(y, m - 1), a: fineMese(y, m - 1) }, etichetta: `${MESI_LUNGHI[m]} ${y}` };
    case "scorso": {
      const d = new Date(y, m - 1, 1);
      return { da: inizioMese(y, m - 1), a: fineMese(y, m - 1), prec: { da: inizioMese(y, m - 2), a: fineMese(y, m - 2) }, etichetta: `${MESI_LUNGHI[d.getMonth()]} ${d.getFullYear()}` };
    }
    case "3mesi": return { ...mesiFa(3), etichetta: "Ultimi 3 mesi" };
    case "6mesi": return { ...mesiFa(6), etichetta: "Ultimi 6 mesi" };
    case "12mesi": return { ...mesiFa(12), etichetta: "Ultimi 12 mesi" };
    case "anno": return { da: `${y}-01-01`, a: `${y}-12-31`, prec: { da: `${y - 1}-01-01`, a: `${y - 1}-12-31` }, etichetta: `Anno ${y}` };
    case "tutto": {
      const date = stato.spese.map((s) => s.data).filter(Boolean).sort();
      return { da: date[0] || oggi(), a: oggi(), prec: null, etichetta: "Da sempre" };
    }
    case "custom": {
      const da = p.da <= p.a ? p.da : p.a, a = p.da <= p.a ? p.a : p.da;
      const g = giorniTra(da, a);
      return { da, a, prec: { da: aggiungiGiorni(da, -g), a: aggiungiGiorni(da, -1) }, etichetta: `${dataCorta(da)} → ${dataBella(a)}` };
    }
    default: return intervallo({ tipo: "mese" });
  }
}

const nelPeriodo = (lista, i) => lista.filter((s) => s.data >= i.da && s.data <= i.a);
const somma = (lista) => lista.reduce((t, s) => t + (Number(s.importo) || 0), 0);

function disegnaPeriodi() {
  $$("[data-periodo]").forEach((box) => {
    box.innerHTML = PERIODI.map((p) => {
      const nome = p.tipo === "custom" && stato.periodo.tipo === "custom" ? `📅 ${intervallo(stato.periodo).etichetta}` : p.nome;
      return `<button type="button" data-p="${p.tipo}" class="${p.tipo === stato.periodo.tipo ? "attivo" : ""}">${esc(nome)}</button>`;
    }).join("");
    box.querySelector(".attivo")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  });
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-p]");
  if (!b) return;
  if (b.dataset.p === "custom") {
    const i = intervallo(stato.periodo);
    $("#p-dal").value = i.da;
    $("#p-al").value = i.a > oggi() ? oggi() : i.a;
    $("#dlg-periodo").showModal();
    return;
  }
  impostaPeriodo({ tipo: b.dataset.p });
});

$("#dlg-periodo").addEventListener("close", () => {
  if ($("#dlg-periodo").returnValue !== "ok") return;
  const da = $("#p-dal").value, a = $("#p-al").value;
  if (da && a) impostaPeriodo({ tipo: "custom", da, a });
});

function impostaPeriodo(p) {
  stato.periodo = p;
  memoria.set("pimpi-periodo", p);
  disegnaTutto();
}

// ─── Riepilogo ────────────────────────────────────────────────
const BATTUTE = {
  zero: [
    "Zero spese? Oberon sospetta un complotto.",
    "Ciotola vuota, portafoglio pieno. Pimpinella non approva.",
  ],
  poco: [
    "Miao! Spesa leggera, come un pisolino al sole.",
    "Pimpinella dice: si può sempre comprare un altro snack.",
  ],
  tanto: [
    "Oberon: «Non guardate me, io mangio solo per crescere!»",
    "Pimpinella approva questi investimenti. Prrrr.",
    "Due pantere nere, un portafoglio solo.",
  ],
};
const scegli = (arr) => arr[Math.floor(Math.random() * arr.length)];

function disegnaRiepilogo() {
  const i = intervallo(stato.periodo);
  const lista = nelPeriodo(stato.spese, i);
  const tot = somma(lista);
  const fine = i.a > oggi() ? oggi() : i.a;
  const giorni = Math.max(1, giorniTra(i.da, fine));
  const mesi = Math.max(1, giorni / 30.4375);

  $("#r-totale").textContent = fmt(tot);
  $("#r-mese").textContent = fmtBreve(tot / mesi);
  $("#r-giorno").textContent = fmt(tot / giorni);
  $("#r-testa").textContent = fmtBreve(tot / 2);
  $("#r-acquisti").textContent = lista.length;
  $("#r-battuta").textContent = scegli(tot === 0 ? BATTUTE.zero : tot / mesi < 40 ? BATTUTE.poco : BATTUTE.tanto);

  const conf = $("#r-confronto");
  if (i.prec) {
    const tp = somma(nelPeriodo(stato.spese, i.prec));
    if (tp > 0) {
      const diff = ((tot - tp) / tp) * 100;
      const cls = diff > 0 ? "su" : "giu";
      const freccia = diff > 0 ? "▲" : "▼";
      conf.innerHTML = `Periodo precedente: ${esc(fmt(tp))} <span class="${cls}">${freccia} ${Math.abs(diff).toFixed(0)}%</span>`;
    } else conf.textContent = "Nessuna spesa nel periodo precedente.";
  } else conf.textContent = "";

  disegnaTorta(lista, tot);
  disegnaBarre(lista, i);
  disegnaTop(lista);
}

function disegnaTorta(lista, tot) {
  const svg = $("#grafico-torta");
  const legenda = $("#legenda");
  const perCat = CATEGORIE.map((c) => ({ ...c, val: somma(lista.filter((s) => cat(s.categoria).id === c.id)) }))
    .filter((c) => c.val > 0)
    .sort((a, b) => b.val - a.val);

  if (!tot) {
    svg.innerHTML = `<circle cx="100" cy="100" r="80" fill="#fff" stroke="#111" stroke-width="4" stroke-dasharray="10 8"/>
      <text x="100" y="108" text-anchor="middle" font-family="Bangers" font-size="24">Niente qui!</text>`;
    legenda.innerHTML = `<li class="vuoto">Nessuna spesa in questo periodo.</li>`;
    return;
  }
  const R = 86, r = 42, cx = 100, cy = 100;
  let ang = -Math.PI / 2;
  const pezzi = perCat.map((c) => {
    const frazione = c.val / tot;
    if (frazione >= 0.9999) {
      return `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${c.colore}" stroke-width="${R - r}"/>`;
    }
    const a0 = ang, a1 = ang + frazione * Math.PI * 2;
    ang = a1;
    const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    const centro = (a0 + a1) / 2;
    const em = frazione > 0.07 ? `<text x="${(cx + 64 * Math.cos(centro)).toFixed(1)}" y="${(cy + 64 * Math.sin(centro) + 6).toFixed(1)}" text-anchor="middle" font-size="17">${c.em}</text>` : "";
    return `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${grande} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${grande} 0 ${p(r, a0)} Z"
      fill="${c.colore}" stroke="#111" stroke-width="3" stroke-linejoin="round"/>${em}`;
  });
  svg.innerHTML = `
    <circle cx="${cx + 5}" cy="${cy + 5}" r="${R}" fill="#111"/>
    ${pezzi.join("")}
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#111" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff8e7" stroke="#111" stroke-width="4"/>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-family="Bangers" font-size="${fmtBreve(tot).length > 8 ? 15 : 18}" letter-spacing=".5">${esc(fmtBreve(tot))}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="Comic Neue" font-weight="700" font-size="10" fill="#6b6b6b">totale</text>`;
  legenda.innerHTML = perCat.map((c) => `
    <li>
      <span class="pallino" style="background:${c.colore}">${c.em}</span>
      <span class="nome">${esc(c.nome)}</span>
      <span class="val">${esc(fmt(c.val))}</span>
      <span class="perc">${Math.round((c.val / tot) * 100)}%</span>
    </li>`).join("");
}

function secchi(i) {
  const fine = i.a;
  const giorni = giorniTra(i.da, fine);
  const out = [];
  if (giorni <= 16) {
    for (let d = i.da; d <= fine; d = aggiungiGiorni(d, 1)) out.push({ da: d, a: d, nome: String(daIso(d).getDate()), lungo: dataBella(d) });
    return { tipo: "giorno", lista: out };
  }
  if (giorni <= 100) {
    let d = daIso(i.da);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunedì
    for (let s = iso(d); s <= fine; s = aggiungiGiorni(s, 7)) {
      const e = aggiungiGiorni(s, 6);
      out.push({ da: s, a: e, nome: dataCorta(s < i.da ? i.da : s), lungo: `Settimana dal ${dataCorta(s)} al ${dataBella(e)}` });
    }
    return { tipo: "settimana", lista: out };
  }
  const d0 = daIso(i.da), d1 = daIso(fine);
  const conAnno = d0.getFullYear() !== d1.getFullYear();
  const Y1 = d1.getFullYear(), M1 = d1.getMonth();
  for (let y = d0.getFullYear(), m = d0.getMonth(); y < Y1 || (y === Y1 && m <= M1); m === 11 ? (m = 0, y++) : m++) {
    out.push({ da: inizioMese(y, m), a: fineMese(y, m), nome: MESI[m] + (conAnno && (m === 0 || out.length === 0) ? ` ${String(y).slice(2)}` : ""), lungo: `${MESI_LUNGHI[m]} ${y}` });
  }
  return { tipo: "mese", lista: out };
}

function disegnaBarre(lista, i) {
  const svg = $("#grafico-barre");
  const didascalia = $("#didascalia-barre");
  const { tipo, lista: bs } = secchi(i);
  $("#titolo-barre").textContent = { giorno: "Giorno per giorno", settimana: "Settimana per settimana", mese: "Mese per mese" }[tipo];
  const valori = bs.map((b) => ({ ...b, val: somma(lista.filter((s) => s.data >= b.da && s.data <= b.a)) }));
  const max = Math.max(...valori.map((v) => v.val), 0);
  didascalia.classList.remove("evidenza");
  if (!max) {
    svg.setAttribute("viewBox", "0 0 340 120");
    svg.innerHTML = `<text x="170" y="64" text-anchor="middle" font-family="Bangers" font-size="22" fill="#6b6b6b">Ancora nessuna barra da mostrare</text>`;
    didascalia.textContent = "";
    return;
  }
  const W = 340, H = 200, sx = 8, basso = 26, alto = 22;
  const n = valori.length;
  const slot = (W - sx * 2) / n;
  const larg = Math.max(4, Math.min(40, slot * 0.68));
  const ogni = Math.ceil(n / 12);
  const scala = (H - basso - alto) / max;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const linee = [0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${(H - basso - f * max * scala).toFixed(1)}" y2="${(H - basso - f * max * scala).toFixed(1)}" stroke="#e5dccb" stroke-width="2" stroke-dasharray="6 6"/>`).join("");
  const barre = valori.map((v, k) => {
    const h = Math.max(v.val ? 3 : 0, v.val * scala);
    const x = sx + k * slot + (slot - larg) / 2;
    const y = H - basso - h;
    const colore = v.val === max ? "#ff7a1a" : "#ffd23f";
    const etich = k % ogni === 0 ? `<text x="${(x + larg / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-family="Comic Neue" font-weight="700" font-size="11">${esc(v.nome)}</text>` : "";
    const cima = v.val === max ? `<text x="${(x + larg / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-family="Bangers" font-size="14">${esc(fmtBreve(v.val))}</text>` : "";
    return `<g class="barra-g" data-k="${k}">
      <rect x="${(x - 2).toFixed(1)}" y="${alto - 10}" width="${(larg + 4).toFixed(1)}" height="${H - basso - alto + 10}" fill="transparent"/>
      ${h ? `<rect x="${(x + 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="#111"/>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${colore}" stroke="#111" stroke-width="2.5"/>` : ""}
      ${cima}${etich}
    </g>`;
  }).join("");
  svg.innerHTML = `${linee}<line x1="0" x2="${W}" y1="${H - basso}" y2="${H - basso}" stroke="#111" stroke-width="3"/>${barre}`;
  didascalia.textContent = "Tocca una barra per vedere la cifra.";
  svg.onclick = (e) => {
    const g = e.target.closest(".barra-g");
    if (!g) return;
    const v = valori[Number(g.dataset.k)];
    $$("#grafico-barre .barra-g").forEach((x) => x.style.opacity = x === g ? "1" : ".45");
    didascalia.textContent = `${v.lungo}: ${fmt(v.val)}`;
    didascalia.classList.add("evidenza");
  };
}

function disegnaTop(lista) {
  const top = [...lista].sort((a, b) => b.importo - a.importo).slice(0, 3);
  $("#box-top").hidden = top.length === 0;
  $("#top-acquisti").innerHTML = top.map((s) => `
    <li>
      <span class="pallino" style="background:${cat(s.categoria).colore}">${cat(s.categoria).em}</span>
      <span class="desc">${esc(s.descrizione || cat(s.categoria).nome)}<small>${esc(dataBella(s.data))}</small></span>
      <strong>${esc(fmt(s.importo))}</strong>
    </li>`).join("");
}

// ─── Lista ────────────────────────────────────────────────────
$("#filtro-categoria").innerHTML += CATEGORIE.map((c) => `<option value="${c.id}">${c.em} ${esc(c.nome)}</option>`).join("");
$("#filtro-categoria").addEventListener("change", (e) => { stato.filtroCat = e.target.value; disegnaLista(); });

function speseLista() {
  const i = intervallo(stato.periodo);
  return nelPeriodo(stato.spese, i)
    .filter((s) => !stato.filtroCat || cat(s.categoria).id === stato.filtroCat)
    .sort((a, b) => (b.data + (b.id || "")).localeCompare(a.data + (a.id || "")));
}

function disegnaLista() {
  const lista = speseLista();
  const box = $("#lista-spese");
  if (!lista.length) {
    box.innerHTML = `<div class="vignetta centrata"><div class="nuvoletta grande">Niente da vedere qui… solo un gatto che dorme. 💤</div>
      <button class="btn" type="button" data-vai="aggiungi">Aggiungi una spesa</button></div>`;
    return;
  }
  const gruppi = new Map();
  for (const s of lista) {
    const k = s.data.slice(0, 7);
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(s);
  }
  box.innerHTML = [...gruppi].map(([k, voci]) => {
    const [y, m] = k.split("-").map(Number);
    return `<div class="mese-lista"><span>${MESI_LUNGHI[m - 1]} ${y}</span><span>${esc(fmt(somma(voci)))}</span></div>` +
      voci.map((s) => {
        const c = cat(s.categoria);
        const chi = nomeAutore(s);
        const sub = [dataCorta(s.data), s.quantita, chi && `da ${chi}`].filter(Boolean).map(esc).join(" · ");
        return `<div class="voce" role="button" tabindex="0" data-id="${esc(s.id)}">
          <span class="pallino" style="background:${c.colore}">${c.em}</span>
          <span class="info"><span class="tit">${esc(s.descrizione || c.nome)}</span><span class="sub">${sub}</span></span>
          <span class="prezzo">${esc(fmt(s.importo))}</span>
          <button type="button" class="ricompra" data-ricompra="${esc(s.id)}" aria-label="Ricompra oggi" title="Ricompra oggi">🔁</button>
        </div>`;
      }).join("");
  }).join("");
}

$("#lista-spese").addEventListener("click", (e) => {
  const r = e.target.closest("[data-ricompra]");
  if (r) { e.stopPropagation(); ricompra(r.dataset.ricompra); return; }
  const v = e.target.closest(".voce");
  if (v) apriModifica(v.dataset.id);
});
$("#lista-spese").addEventListener("keydown", (e) => {
  const v = e.target.closest(".voce");
  if (v && (e.key === "Enter" || e.key === " ") && e.target === v) { e.preventDefault(); apriModifica(v.dataset.id); }
});

function ricompra(id) {
  const s = stato.spese.find((x) => x.id === id);
  if (!s) return;
  riempiModulo({ ...s, data: oggi() });
  stato.inModifica = null;
  mostraModalitaModulo();
  vai("aggiungi");
  toast("Controlla il prezzo e salva 🐾");
}

$("#btn-csv").addEventListener("click", () => {
  const lista = speseLista();
  const righe = [["Data", "Categoria", "Descrizione", "Quantità", "Importo", "Inserita da"]]
    .concat(lista.map((s) => [s.data, cat(s.categoria).nome, s.descrizione || "", s.quantita || "", String(s.importo).replace(".", ","), nomeAutore(s)]));
  const csv = "﻿" + righe.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `spese-gatti-${oggi()}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ─── Modulo spesa ─────────────────────────────────────────────
$("#f-categorie").innerHTML = CATEGORIE.map((c) =>
  `<button type="button" data-cat="${c.id}" style="--colore:${c.colore}" aria-pressed="false"><span class="em">${c.em}</span>${esc(c.nome)}</button>`).join("");
$("#f-categorie").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cat]");
  if (b) scegliCategoria(b.dataset.cat);
});
function scegliCategoria(id) {
  stato.categoria = cat(id).id;
  $$("#f-categorie [data-cat]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === stato.categoria)));
}

function riempiModulo(s) {
  $("#f-importo").value = s.importo != null ? String(s.importo).replace(".", ",") : "";
  $("#f-descrizione").value = s.descrizione || "";
  $("#f-quantita").value = s.quantita || "";
  $("#f-data").value = s.data || oggi();
  scegliCategoria(s.categoria || "secco");
  $("#f-errore").textContent = "";
}

function mostraModalitaModulo() {
  const mod = !!stato.inModifica;
  $("#titolo-modulo").textContent = mod ? "Modifica spesa" : "Nuova spesa";
  $("#f-salva").textContent = mod ? "Salva modifiche ✏️" : "Salva! 🐟";
  $("#azioni-modifica").hidden = !mod;
  $("#box-rapidi").hidden = mod || !$("#rapidi").children.length;
}

function moduloNuovo() {
  stato.inModifica = null;
  riempiModulo({ categoria: stato.categoria, data: oggi() });
  mostraModalitaModulo();
}

function apriModifica(id) {
  const s = stato.spese.find((x) => x.id === id);
  if (!s) return;
  stato.inModifica = id;
  riempiModulo(s);
  mostraModalitaModulo();
  vai("aggiungi", { mantieni: true });
}

function aggiornaSuggerimenti() {
  const visti = new Set();
  const recenti = [];
  const ordinate = [...stato.spese].sort((a, b) => b.data.localeCompare(a.data));
  for (const s of ordinate) {
    const k = `${s.categoria}|${(s.descrizione || "").toLowerCase()}`;
    if (!s.descrizione || visti.has(k)) continue;
    visti.add(k);
    recenti.push(s);
  }
  $("#lista-descrizioni").innerHTML = recenti.map((s) => `<option value="${esc(s.descrizione)}"></option>`).join("");
  $("#rapidi").innerHTML = recenti.slice(0, 8).map((s) =>
    `<button type="button" data-rapido="${esc(s.id)}">${cat(s.categoria).em} ${esc(s.descrizione)} · ${esc(fmt(s.importo))}</button>`).join("");
  if (!stato.inModifica) $("#box-rapidi").hidden = !recenti.length;
}
$("#rapidi").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rapido]");
  if (!b) return;
  const s = stato.spese.find((x) => x.id === b.dataset.rapido);
  if (s) { riempiModulo({ ...s, data: oggi() }); $("#f-importo").focus(); }
});

$("#f-descrizione").addEventListener("change", (e) => {
  // Se la descrizione corrisponde a un acquisto passato, propone categoria e prezzo
  const testo = e.target.value.trim().toLowerCase();
  if (!testo || stato.inModifica) return;
  const s = [...stato.spese].sort((a, b) => b.data.localeCompare(a.data)).find((x) => (x.descrizione || "").toLowerCase() === testo);
  if (!s) return;
  scegliCategoria(s.categoria);
  if (!$("#f-importo").value) $("#f-importo").value = String(s.importo).replace(".", ",");
  if (!$("#f-quantita").value && s.quantita) $("#f-quantita").value = s.quantita;
});

$("#form-spesa").addEventListener("submit", (e) => {
  e.preventDefault();
  const importo = leggiImporto($("#f-importo").value);
  const err = $("#f-errore");
  if (!Number.isFinite(importo) || importo <= 0) { err.textContent = "Scrivi un importo valido, per esempio 12,50."; $("#f-importo").focus(); return; }
  if (importo >= 10000) { err.textContent = "Un po' tanto anche per due gatti! Controlla l'importo."; return; }
  const data = $("#f-data").value;
  if (!data) { err.textContent = "Manca la data."; return; }
  const voce = {
    importo,
    categoria: stato.categoria,
    descrizione: $("#f-descrizione").value.trim(),
    quantita: $("#f-quantita").value.trim(),
    data,
  };
  const id = stato.inModifica;
  const op = id ? archivio.modifica(id, voce) : archivio.aggiungi(voce);
  Promise.resolve(op).catch((x) => { console.error(x); toast("Non sono riuscito a salvare: " + messaggioErrore(x), true); });
  toast(id ? "Modificata! ✏️" : `Salvata! ${fmt(importo)} 🐾`);
  stato.inModifica = null;
  riempiModulo({ categoria: voce.categoria, data: oggi() }); // modulo pulito, stessa categoria
  vai(id ? "lista" : "riepilogo");
});

$("#f-annulla").addEventListener("click", () => { moduloNuovo(); vai("lista"); });
$("#f-elimina").addEventListener("click", () => {
  const id = stato.inModifica;
  if (!id || !confirm("Eliminare questa spesa?")) return;
  Promise.resolve(archivio.elimina(id)).catch((x) => toast("Errore: " + messaggioErrore(x), true));
  moduloNuovo();
  toast("Eliminata 🗑️");
  vai("lista");
});

// ─── Navigazione ──────────────────────────────────────────────
function vai(vista, { mantieni = false } = {}) {
  if (vista === "aggiungi" && !mantieni && stato.vista !== "aggiungi" && !stato.inModifica) {
    // nuovo modulo pulito, ma non sovrascrivere un "ricompra" appena riempito
    if (!$("#f-importo").value) moduloNuovo(); else mostraModalitaModulo();
  }
  if (vista !== "aggiungi" && stato.inModifica) { stato.inModifica = null; moduloNuovo(); }
  stato.vista = vista;
  mostraSoloVista(vista);
  $$("#barra [data-vai]").forEach((b) => b.classList.toggle("attivo", b.dataset.vai === vista));
  $(`#vista-${vista}`).classList.remove("pop");
  void $(`#vista-${vista}`).offsetWidth;
  $(`#vista-${vista}`).classList.add("pop");
  window.scrollTo({ top: 0 });
  if (vista === "aggiungi" && !stato.inModifica) setTimeout(() => $("#f-importo").focus({ preventScroll: true }), 50);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-vai]");
  if (b) vai(b.dataset.vai);
});

function disegnaTutto() {
  disegnaPeriodi();
  disegnaRiepilogo();
  disegnaLista();
  aggiornaSuggerimenti();
}

// ─── Impostazioni ─────────────────────────────────────────────
$("#btn-impostazioni").addEventListener("click", () => $("#dlg-impostazioni").showModal());
$("#link-guida-prova").addEventListener("click", (e) => { e.preventDefault(); $("#dlg-impostazioni").showModal(); });
$("#btn-esci").addEventListener("click", async () => {
  $("#dlg-impostazioni").close();
  await archivio.esci?.();
});
$("#btn-svuota").addEventListener("click", () => {
  if (!confirm("Cancellare tutti i dati di prova su questo telefono?")) return;
  archivio.sostituisci([]);
  $("#dlg-impostazioni").close();
  toast("Dati di prova cancellati");
});
$("#btn-esempio").addEventListener("click", () => {
  archivio.sostituisci(datiEsempio());
  $("#dlg-impostazioni").close();
  impostaPeriodo({ tipo: "6mesi" });
  toast("Ecco qualche spesa di esempio 🐈‍⬛");
});

function datiEsempio() {
  const out = [];
  const n = new Date();
  let seme = 7;
  const rnd = () => { seme = (seme * 9301 + 49297) % 233280; return seme / 233280; };
  for (let k = 0; k < 7; k++) {
    const y = n.getFullYear(), m = n.getMonth() - k;
    const giorno = (g) => { const d = new Date(y, m, g); return d > n ? null : iso(d); };
    const voci = [
      [3, "secco", "Crocchette sterilizzati 3 kg", "1 sacco", 32.9],
      [5, "umido", "Bustine al salmone", "24 bustine", 18.5 + Math.round(rnd() * 4)],
      [12, "lettiera", "Sabbia agglomerante", "2 × 10 L", 15.8],
      [18, "umido", "Patè pollo e tacchino", "12 lattine", 13.2],
      [22, "snack", "Snack cremosi", "2 confezioni", 6.4],
    ];
    if (k % 3 === 1) voci.push([9, "salute", "Antiparassitario", "2 pipette", 24.9]);
    if (k === 2) voci.push([15, "salute", "Visita veterinaria Oberon", "", 55]);
    if (k === 4) voci.push([27, "giochi", "Tiragraffi a colonna", "", 29.99]);
    for (const [g, c, d, q, imp] of voci) {
      const data = giorno(g);
      if (data) out.push({ id: `es-${k}-${g}-${c}`, data, categoria: c, descrizione: d, quantita: q, importo: imp, autore: "tu" });
    }
  }
  return out;
}

// ─── Accesso ──────────────────────────────────────────────────
function messaggioErrore(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-email"))
    return "Email o password sbagliate.";
  if (c.includes("too-many-requests")) return "Troppi tentativi. Riprova tra qualche minuto.";
  if (c.includes("network")) return "Niente connessione internet.";
  if (c.includes("permission-denied")) return "Questo account non ha il permesso. Controlla le regole di Firestore (LEGGIMI.md).";
  return e?.message || "Errore sconosciuto.";
}

$("#form-accesso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("#form-accesso button");
  btn.disabled = true;
  $("#acc-errore").textContent = "";
  try {
    await archivio.entra($("#acc-email").value.trim(), $("#acc-password").value);
  } catch (x) {
    $("#acc-errore").textContent = messaggioErrore(x);
  } finally {
    btn.disabled = false;
  }
});

function chiediNome() {
  mostraSoloVista("chi");
  $("#scelta-nome").innerHTML = nomi.map((n) => `<button class="btn btn-grande" type="button" data-nome="${esc(n)}">${esc(n)}</button>`).join("");
}
$("#scelta-nome").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-nome]");
  if (!b) return;
  $$("#scelta-nome button").forEach((x) => { x.disabled = true; });
  try {
    await archivio.impostaNome(b.dataset.nome);
    $("#imp-utente").textContent = `Collegato come ${b.dataset.nome}`;
    toast(`Ciao ${b.dataset.nome}! 🐾`);
    entraNellApp();
  } catch (x) {
    toast("Errore: " + messaggioErrore(x), true);
    $$("#scelta-nome button").forEach((x) => { x.disabled = false; });
  }
});

function mostraSoloVista(id) {
  ["accesso", "chi", "caricamento", "riepilogo", "aggiungi", "lista"].forEach((v) => { $(`#vista-${v}`).hidden = v !== id; });
}

function entraNellApp() {
  $("#barra").hidden = false;
  $("#btn-impostazioni").hidden = false;
  smetti?.();
  smetti = archivio.ascolta(
    (lista) => { stato.spese = lista.filter((s) => s && s.data); disegnaTutto(); },
    (err) => { console.error(err); toast(messaggioErrore(err), true); },
  );
  moduloNuovo();
  vai(stato.vista === "aggiungi" ? "riepilogo" : stato.vista);
}

// ─── Avvio ────────────────────────────────────────────────────
async function avvia() {
  if (!firebaseConfig) {
    archivio = archivioLocale();
    $("#banner-prova").hidden = false;
    $("#imp-prova").hidden = false;
    $("#imp-utente").textContent = "";
    entraNellApp();
    return;
  }
  try {
    archivio = await archivioFirebase();
  } catch (x) {
    console.error(x);
    mostraSoloVista("caricamento");
    $("#vista-caricamento").innerHTML = `<div class="vignetta centrata"><div class="nuvoletta grande">Non riesco a collegarmi a Firebase. Controlla la connessione o il file config.js.</div></div>`;
    return;
  }
  archivio.onUtente((u) => {
    if (u) {
      $("#btn-esci").hidden = false;
      if (!u.displayName && nomi.length) { chiediNome(); return; }
      $("#imp-utente").textContent = `Collegato come ${u.displayName || u.email}`;
      entraNellApp();
    } else {
      smetti?.(); smetti = null;
      stato.spese = [];
      $("#barra").hidden = true;
      $("#btn-impostazioni").hidden = true;
      mostraSoloVista("accesso");
    }
  });
}

avvia();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
