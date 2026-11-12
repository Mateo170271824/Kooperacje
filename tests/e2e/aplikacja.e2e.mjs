// Test ekranowy całej aplikacji na emulatorze Firebase (prawdziwe reguły z Logistyki) i wymyślonych danych.
// Uruchomienie: python3 -m http.server 8766 & npm run test:e2e   (wymaga Javy, firebase-tools, firebase, @firebase/rules-unit-testing, playwright)
// FB_LOCAL=<katalog node_modules/firebase> – biblioteka Firebase z dysku zamiast z gstatic.com (komputer bez internetu).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, updateDoc, collection } from "firebase/firestore";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const TU = dirname(fileURLToPath(import.meta.url)), REPO = join(TU, "..", "..");
const ADRES = process.env.ADRES || "http://localhost:8766/index.html?emu";
const PID = "logistyka-app-41d7a", DOM = "@konta." + PID + ".firebaseapp.com";
const TMP = mkdtempSync(join(tmpdir(), "koop-e2e-"));
const kt = { console }; kt.self = kt; vm.createContext(kt);
vm.runInContext(readFileSync(join(REPO, "vendor/xlsx.full.min.js"), "utf8"), kt);
const XLSX = kt.XLSX;

const env = await initializeTestEnvironment({ projectId: PID, firestore: { rules: readFileSync(join(TU, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8085 } });
const baza = async fn => { let w; await env.withSecurityRulesDisabled(async c => { w = await fn(c.firestore()); }); return w; };
const kursy = () => baza(async db => (await getDocs(collection(db, "kursy"))).docs.map(d => ({ id: d.id, ...d.data() })));
const dok = (k, id) => baza(async db => (await getDoc(doc(db, k, id))).data());
async function konto(login) {
  const r = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: login + DOM, password: "haslo123", returnSecureToken: true }) });
  return (await r.json()).localId;
}
const U = { admin: await konto("admin"), biuro: await konto("biuro") };
await baza(async db => {
  const s = (p, d) => setDoc(doc(db, p), d);
  await s("meta/init", { admin: U.admin });
  await s("uzytkownicy/" + U.admin, { login: "admin", nazwa: "Jan Testowy", rola: "biuro", aktywny: true });
  await s("uzytkownicy/" + U.biuro, { login: "biuro", nazwa: "Ewa z biura", rola: "biuro", aktywny: true });
  await s("ustawienia/glowne", { kursEUR: 4.25, dostawcy: [{ nazwa: "Huta Testowa", adres: "ul. Hutnicza 1, 00-002 Y", kontakt: "", email: "huta@example.com" }] });
  await s("koop_podwykonawcy/p1", { nazwa: "Podwykonawca A", adres: "ul. Fabryczna 3, 00-001 X", tel: "600 000 999", kolor: 0, kolejnosc: 1 });
  await s("koop_podwykonawcy/p2", { nazwa: "Podwykonawca B", kolor: 1, kolejnosc: 2 });
  await s("koop_ustawienia/slowniki", { rodzaje: ["Kątowniki", "Obróbki", "Inne"] });
  await s("koop_zlecenia/stare", { data: "2030-01-15", podw: "p1", nr: "STEC", projekt: "STEC", opis: "Stare zlecenie", status: "Zlecone", wersja: 1 });
});
// arkusz z podwykonawcami (wymyślony)
const plikPodw = join(TMP, "podwykonawcy.xlsx");
{ const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Nazwa", "Osoba / dział", "Telefon", "Adres odbioru", "E-mail"],
    ["Podwykonawca B", "Gięcie", "600 000 222", "ul. Nowa 2, 00-003 Z", "b@example.com"], ["Podwykonawca C", "Laser", "600 000 333", "", ""]]), "Arkusz1");
  writeFileSync(plikPodw, Buffer.from(XLSX.write(wb, { type: "array", bookType: "xlsx" }))); }

const b = await chromium.launch();
const bledy = [], wyniki = [];
const ok = (n, v, extra = "") => wyniki.push((v ? "OK    " : "BŁĄD  ") + n + (extra ? "  → " + extra : ""));
async function sesja(login) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true });
  if (process.env.FB_LOCAL) await ctx.route(/https:\/\/www\.gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+\.js)$/, (r, q) => {
    const v = q.url().split("/").slice(-2)[0];
    r.fulfill({ body: readFileSync(join(process.env.FB_LOCAL, q.url().split("/").pop()), "utf8").replace(/\/firebasejs\/[0-9.]+\//g, `/firebasejs/${v}/`), contentType: "text/javascript" });
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  p.on("pageerror", e => bledy.push(login + ": " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) bledy.push(login + " (konsola): " + m.text()); });
  await p.goto(ADRES + "#zlecenia"); await p.waitForSelector("#vLogin:not([hidden])");
  await p.fill("#lLogin", login); await p.fill("#lPass", "haslo123"); await p.press("#lPass", "Enter");
  await p.waitForSelector("#vApp:not([hidden])"); await p.waitForTimeout(1200);
  return { ctx, p };
}
const toast = async p => { const t = await p.waitForSelector("#toast:not([hidden])", { timeout: 8000 }).then(() => p.textContent("#toast")); await p.evaluate(() => { document.getElementById("toast").hidden = true; }); return t; };
const wiersz = (p, t) => p.locator("#zRows tr", { hasText: t });
const otworz = async (p, t) => { await wiersz(p, t).first().click(); await p.waitForSelector("#dlgZ[open]"); };
const zakladka = async (p, t) => { await p.click(`nav.tabs [data-tab=${t}]`); await p.waitForTimeout(300); };

try {
  // ===== zwykłe konto biura =====
  let { ctx, p } = await sesja("biuro");
  await p.click("#btnNew");
  ok("nowe zlecenie: „wyślij do logistyki” domyślnie zaznaczone", await p.isChecked("#z_dolog"));
  await p.fill("#z_data", "2030-01-10"); await p.selectOption("#z_podw", "p1"); await p.fill("#z_nr", "LECM"); await p.selectOption("#z_rodzaj", "Kątowniki");
  await p.fill("#z_opis", "Kątownik L50 cięty"); await p.fill("#z_ilosc", "12"); await p.fill("#z_uwagi", "pilne");
  // Enter w polu jednowierszowym nie zapisuje zlecenia; w opisie – nowa linia
  await p.focus("#z_nr"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  const otwarte = await p.isVisible("#zSave");
  await p.focus("#z_opis"); await p.keyboard.press("End"); await p.keyboard.press("Enter"); await p.keyboard.type("otwory fi 18");
  ok("zlecenie: Enter nie zapisuje, w opisie nowa linia", otwarte && (await p.inputValue("#z_opis")) === "Kątownik L50 cięty\notwory fi 18");
  await p.fill("#z_opis", "Kątownik L50 cięty");
  await p.click("#zSave"); const t1 = await toast(p);
  ok("zapis zlecenia z kursem", /logistyka dostała kurs/.test(t1), t1);
  let K = await kursy(), k = K[0];
  ok("kurs w Truck App bez kierowcy, do uzupełnienia", K.length === 1 && k.zrodlo === "KOOP" && k.transport === "Skavska" && !k.nasz && k.doUzup === true && k.status === "Oczekuje na kierowcę", JSON.stringify({ n: K.length, nasz: k?.nasz, doUzup: k?.doUzup }));
  ok("kurs ma adres i telefon podwykonawcy", k.miejsce === "ul. Fabryczna 3, 00-001 X" && k.kontakt === "600 000 999" && k.zal === "2030-01-10");
  ok("koszty kursu", (await dok("koszty", k.id))?.dataS === "2030-01-10");
  ok("zlecenie zna swój kurs", (await dok("koop_zlecenia", k.koopId)).kursId === k.id);
  await p.waitForTimeout(800);
  ok("projekt LECM we wspólnym słowniku", (await dok("projekty", "LECM"))?.zrodla?.koop === true, JSON.stringify(await dok("projekty", "LECM")));
  await p.waitForTimeout(800);
  ok("lista: „czeka na kierowcę”", /czeka na kierowcę/.test(await wiersz(p, "Kątownik L50").textContent()));
  // logistyka przypisuje kierowcę
  await baza(db => updateDoc(doc(db, "kursy", k.id), { nasz: "Marek Testowy", auto: "AB 12345", status: "W realizacji", doUzup: false, uwagi: "od logistyki" }));
  await p.waitForTimeout(1200);
  ok("lista: widać kierowcę z logistyki", /Marek Testowy · AB 12345/.test(await wiersz(p, "Kątownik L50").textContent()));
  // zmiana daty i opisu
  await otworz(p, "Kątownik L50");
  ok("okno zlecenia: stan kursu", /Marek Testowy/.test(await p.textContent("#zKurs")));
  await p.fill("#z_data", "2030-01-11"); await p.fill("#z_opis", "Kątownik L50 cięty + otwory"); await p.click("#zSave"); const t3 = await toast(p);
  k = (await kursy()).find(x => x.id === k.id);
  ok("zmiana daty w kursie, kierowca zostaje", k.zal === "2030-01-11" && k.dataS === "2030-01-11" && k.nasz === "Marek Testowy" && k.uwagi === "od logistyki" && /otwory/.test(k.ladunek.opis), t3);
  ok("koszty: nowa data", (await dok("koszty", k.id)).dataS === "2030-01-11");
  // Odebrane
  await wiersz(p, "Kątownik L50").locator("[data-odb]").click(); await toast(p);
  k = (await kursy()).find(x => x.id === k.id);
  ok("Odebrane zamyka kurs jako dostarczony", k.status === "Dostarczone" && !!k.dst, k.status);
  // bez transportu
  await p.click("#btnNew"); await p.fill("#z_data", "2030-01-12"); await p.selectOption("#z_podw", "p2"); await p.fill("#z_opis", "Dowiezie podwykonawca");
  await p.uncheck("#z_dolog"); await p.click("#zSave"); await toast(p);
  ok("zlecenie bez transportu nie tworzy kursu", (await kursy()).length === 1);
  // stare zlecenie → kurs; odznaczenie → anulowany
  await otworz(p, "Stare zlecenie");
  ok("stare zlecenie: pole odznaczone", !(await p.isChecked("#z_dolog")));
  await p.check("#z_dolog"); await p.click("#zSave"); await toast(p);
  const k6 = (await kursy()).find(x => x.koopId === "stare");
  ok("stare zlecenie wysłane do logistyki", !!k6 && k6.proj === "STEC");
  await otworz(p, "Stare zlecenie"); await p.uncheck("#z_dolog"); await p.click("#zSave"); await toast(p);
  ok("odznaczenie anuluje kurs i go odpina", (await kursy()).find(x => x.id === k6.id).status === "Anulowane" && (await dok("koop_zlecenia", "stare")).kursId === "");
  // wszystkie zakładki rysują się bez błędów; plan tygodnia jako PDF
  for (const t of ["pulpit", "kalendarz", "tydzien", "podwykonawcy", "zlecenia"]) { await zakladka(p, t); ok("zakładka " + t, await p.isVisible("#v-" + t)); }
  await zakladka(p, "tydzien");
  for (let i = 0; i < 400 && !(await p.textContent("#wkTitle")).includes("11.01.2030"); i++) await p.click("#wkNext");
  await p.selectOption("#wkShow", "all");
  const wkBtns = await p.$$eval("#wkMail a[href^='mailto:']", a => a.map(x => x.textContent.trim()));
  const wkHref = await p.$eval("#wkMail .wkPodw a", a => decodeURIComponent(a.href)).catch(() => "");
  ok("plan tygodnia: mail od razu (cały plan + każdy podwykonawca)", wkBtns.some(t => t.includes("Wyślij cały plan")) && wkBtns.length >= 2 && wkHref.includes("Plan odbiorów – tydzień 2"), wkBtns.join(" | "));
  const pdf = await Promise.all([p.waitForEvent("download", { timeout: 45000 }), p.click("#wkPdf")]).then(([d]) => d.suggestedFilename(), async e => "brak pliku: " + e.message.split("\n")[0]);
  ok("plan tygodnia jako PDF", /^plan-odbiorow-tydz-\d+\.pdf$/.test(pdf), pdf);
  await ctx.close();

  // ===== administrator: podwykonawcy z pliku, wspólna lista z Truck App, usunięcie zlecenia =====
  ({ ctx, p } = await sesja("admin"));
  await zakladka(p, "podwykonawcy");
  ok("przycisk wczytania podwykonawców z Excela", await p.isVisible("#btnSeed"));
  await p.setInputFiles("#seedFile", plikPodw); const tw = await toast(p);
  ok("import podwykonawców z pliku", /1 nowych, 1 zaktualizowanych/.test(tw), tw);
  const pB = await dok("koop_podwykonawcy", "p2");
  ok("istniejący podwykonawca uzupełniony", pB.tel === "600 000 222" && pB.adres === "ul. Nowa 2, 00-003 Z" && pB.kolor === 1);
  let dost = (await dok("ustawienia", "glowne")).dostawcy;
  ok("podwykonawcy na liście dostawców Truck App", ["Podwykonawca B", "Podwykonawca C"].every(n => dost.some(x => x.nazwa === n && x.koop)) && dost.some(x => x.nazwa === "Huta Testowa"), dost.map(x => x.nazwa).join(", "));
  // nowy podwykonawca wybrany z dostawców Truck App – dane się uzupełniają
  await p.click("#btnNewSup"); await p.waitForTimeout(500);
  await p.fill("#s_nazwa", "Huta Testowa"); await p.dispatchEvent("#s_nazwa", "change"); await toast(p);
  ok("dane z listy dostawców Truck App", (await p.inputValue("#s_adres")) === "ul. Hutnicza 1, 00-002 Y" && (await p.inputValue("#s_email")) === "huta@example.com");
  await p.fill("#s_tel", "600 000 444"); await p.click("#fS button[type=submit]");
  await p.waitForFunction(() => /podwykonawc/i.test(document.getElementById("toast").textContent), null, { timeout: 8000 }).catch(() => {});
  const ts = await toast(p).catch(async () => "brak komunikatu; błąd formularza: " + (await p.textContent("#sErr")));
  dost = (await dok("ustawienia", "glowne")).dostawcy;
  ok("telefon trafił do dostawcy w Truck App", dost.find(x => x.nazwa === "Huta Testowa")?.tel === "600 000 444", ts);
  if (await p.isVisible("#dlgS")) await p.keyboard.press("Escape");
  await zakladka(p, "zlecenia");
  await otworz(p, "Stare zlecenie"); await p.check("#z_dolog"); await p.click("#zSave"); await toast(p);
  const k8 = (await kursy()).find(x => x.koopId === "stare" && x.status !== "Anulowane");
  await otworz(p, "Stare zlecenie"); await p.click("#zDel"); await p.click("#zDelYes"); const td = await toast(p);
  ok("usunięcie zlecenia anuluje kurs", (await kursy()).find(x => x.id === k8.id).status === "Anulowane", td);
  for (const t of ["raporty", "weryfikacja", "dostep"]) { await zakladka(p, t); ok("zakładka administratora " + t, await p.isVisible("#v-" + t)); }
  await ctx.close();
} catch (e) { bledy.push("TEST: " + (e.stack || e.message)); }
await b.close(); await env.cleanup();
console.log(wyniki.join("\n"));
if (bledy.length) console.log("\nBłędy strony:\n" + bledy.join("\n"));
const zle = wyniki.filter(w => w.startsWith("BŁĄD")).length + bledy.length;
console.log(`\n${wyniki.length - wyniki.filter(w => w.startsWith("BŁĄD")).length}/${wyniki.length} OK` + (bledy.length ? `, błędów strony: ${bledy.length}` : ""));
process.exit(zle ? 1 : 0);
