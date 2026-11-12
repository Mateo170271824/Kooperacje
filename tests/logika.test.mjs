// Testy logiki Kooperacji (dane wymyślone, bez danych firmy). Uruchomienie: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/logika.js";

test("daty", () => {
  assert.equal(L.addD("2026-12-30", 3), "2027-01-02");
  assert.equal(L.monday("2026-11-08"), "2026-11-02");          // niedziela → poniedziałek tego tygodnia
  assert.equal(L.isoWeek("2026-01-01"), 1);
  assert.equal(L.isoWeek("2026-12-31"), 53);
  assert.equal(L.fD("2026-11-07"), "07.11.2026");
  assert.equal(L.dniMiedzy("2026-11-01", "2026-11-11"), 10);
  assert.equal(L.plural(1, "zlecenie", "zlecenia", "zleceń"), "zlecenie");
  assert.equal(L.plural(3, "zlecenie", "zlecenia", "zleceń"), "zlecenia");
  assert.equal(L.plural(12, "zlecenie", "zlecenia", "zleceń"), "zleceń");
  assert.equal(L.plural(22, "zlecenie", "zlecenia", "zleceń"), "zlecenia");
});

test("login jak w Truck App", () => {
  assert.equal(L.normLogin("  Łukasz Żółć "), "lukasz.zolc");
  assert.equal(L.esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
});

test("alert terminu odbioru", () => {
  const t = "2026-11-10";
  assert.deepEqual(L.alertOf({ data: "2026-11-09", status: "Zlecone" }, t)[0], "⚠ Po terminie");
  assert.equal(L.alertOf({ data: t, status: "W realizacji" }, t)[0], "Dziś");
  assert.equal(L.alertOf({ data: "2026-11-17", status: "Zlecone" }, t)[0], "W ciągu 7 dni");
  assert.equal(L.alertOf({ data: "2026-11-18", status: "Zlecone" }, t), null);
  assert.equal(L.alertOf({ data: "2026-11-01", status: "Odebrane" }, t), null);
});

test("różnice zlecenia (historia)", () => {
  const z = { data: "2026-11-10", podw: "p1", nr: "LECM", opis: "Uszka", ilosc: 4, status: "Zlecone" };
  assert.deepEqual(L.diff(z, { ...z }), {});
  assert.deepEqual(L.diff(z, { ...z, ilosc: 5 }), { ilosc: [4, 5] });
  // stare zlecenie bez pola doLog = false, nie „zmiana”
  assert.deepEqual(L.diff(z, { ...z, doLog: false }), {});
  assert.deepEqual(L.diff(z, { ...z, doLog: true }), { doLog: [false, true] });
});

test("weryfikacja PZ: daty, liczby, numery w uwagach, dostawca", () => {
  assert.equal(L.cellDate("05.11.2026"), "2026-11-05");
  assert.equal(L.cellDate(46331), "2026-11-05");
  assert.equal(L.cellNum("1 250,50 zł"), 1250.5);
  assert.equal(L.cellNum("x"), null);
  assert.ok(L.nrInText("LECM", "PZ do zlecenia lecm / poz. 3"));
  assert.ok(!L.nrInText("LEC", "PZ LECM"));
  const P = [{ id: "a", nazwa: "Firma Testowa" }, { id: "b", nazwa: "Gięcie-Pol", symbolMag: "GPOL" }];
  assert.equal(L.matchSup("FIRMA TESTOWA SP. Z O.O.", P), "a");
  assert.equal(L.matchSup("GPOL", P), "b");
  assert.equal(L.matchSup("Inna", P), "");
});

const JA = { login: "ania", nazwa: "Ania" }, PODW = { nazwa: "Podwykonawca A", adres: "ul. Testowa 1, 00-001 Miasto", tel: "600 000 000" };
const ZL = { data: "2026-11-12", podw: "p1", nr: "LECM", projekt: "", opis: "Kątownik L50", rodzaj: "Kątowniki", ilosc: 12, status: "Zlecone", uwagi: "pilne", doLog: true };

test("nowy kurs z zlecenia: bez kierowcy, do uzupełnienia przez logistykę", () => {
  const k = L.nowyKurs("z1", ZL, PODW, JA, "TS", 123);
  for (const f of L.POLA_KURSU) assert.ok(f in k, "brak pola " + f);
  assert.equal(k.typ, "D"); assert.equal(k.zrodlo, "KOOP"); assert.equal(k.koopId, "z1");
  assert.equal(k.transport, "Skavska"); assert.equal(k.nasz, ""); assert.equal(k.kierUid, ""); assert.equal(k.auto, "");
  assert.equal(k.status, "Oczekuje na kierowcę"); assert.equal(k.doUzup, true);
  assert.equal(k.kontr, "Podwykonawca A"); assert.equal(k.miejsce, PODW.adres); assert.equal(k.kontakt, PODW.tel);
  assert.equal(k.zal, ZL.data); assert.equal(k.dataS, ZL.data); assert.equal(k.proj, "LECM");
  assert.equal(k.ladunek.opis, "Kątowniki – Kątownik L50"); assert.equal(k.ladunek.ilosc, "12 szt.");
  assert.deepEqual(k.odZakupow, { kto: "ania", nazwa: "Ania", czas: 123 });
  assert.equal(k.zmieniono, "TS"); assert.deepEqual(k.punkty, []); assert.equal(k.waga, null);
});

test("zmiany zlecenia nie ruszają tego, co ustawiła logistyka", () => {
  const kurs = { ...L.nowyKurs("z1", ZL, PODW, JA, "TS"), nasz: "Kierowca X", auto: "AB 123", status: "W realizacji", uwagi: "od logistyki", doUzup: false };
  const nowe = { ...ZL, data: "2026-11-13", opis: "Kątownik L50 + otwory" };
  const u = L.zmianyKursu(kurs, nowe, L.diff(ZL, nowe), PODW, JA, "TS2", "2026-11-07");
  assert.equal(u.zal, "2026-11-13"); assert.equal(u.dataS, "2026-11-13");
  assert.equal(u.ladunek.opis, "Kątowniki – Kątownik L50 + otwory");
  for (const f of ["nasz", "auto", "status", "uwagi", "doUzup", "kierUid"]) assert.ok(!(f in u), "zmienione pole " + f);
  // bez zmian w polach kursu → nic
  assert.equal(L.zmianyKursu(kurs, { ...ZL, uwagi: "inne" }, L.diff(ZL, { ...ZL, uwagi: "inne" }), PODW, JA, "TS2"), null);
});

test("odebrane, anulowane, odznaczone, przywrócone", () => {
  const kurs = { ...L.nowyKurs("z1", ZL, PODW, JA, "TS"), status: "W realizacji" };
  const odb = L.zmianyKursu(kurs, { ...ZL, status: "Odebrane", odebrano: "2026-11-12" }, {}, PODW, JA, "T");
  assert.equal(odb.status, "Dostarczone"); assert.equal(odb.dst, "2026-11-12"); assert.equal(L.rodzajZmianyKursu(odb), "dostarczony");
  assert.equal(L.zmianyKursu(kurs, { ...ZL, status: "Anulowane" }, {}, PODW, JA, "T").status, "Anulowane");
  assert.equal(L.zmianyKursu(kurs, { ...ZL, doLog: false }, {}, PODW, JA, "T").status, "Anulowane");
  // kurs już dostarczony – anulowanie zlecenia go nie zmienia
  assert.equal(L.zmianyKursu({ ...kurs, status: "Dostarczone" }, { ...ZL, status: "Anulowane" }, {}, PODW, JA, "T"), null);
  const prz = L.zmianyKursu({ ...kurs, status: "Anulowane" }, ZL, {}, PODW, JA, "T");
  assert.equal(prz.status, "Oczekuje na kierowcę"); assert.equal(prz.doUzup, true); assert.equal(L.rodzajZmianyKursu(prz), "przywrocony");
});

test("stan kursu widoczny w Kooperacjach", () => {
  const z = { kursId: "k1", data: "2026-11-12" };
  assert.equal(L.kursStan({}, undefined), null);
  assert.match(L.kursStan(z, undefined).txt, /usunięty/);
  assert.match(L.kursStan(z, { transport: "Skavska", status: "Oczekuje na kierowcę" }).txt, /czeka na kierowcę/);
  assert.equal(L.kursStan(z, { transport: "Skavska", nasz: "Jan K", auto: "AB 1", status: "W realizacji", zal: "2026-11-12" }).txt, "🚚 Jan K · AB 1");
  assert.match(L.kursStan(z, { transport: "Skavska", nasz: "Jan K", status: "W realizacji", zal: "2026-11-14" }).txt, /14\.11/);
  assert.match(L.kursStan(z, { status: "Dostarczone", nasz: "Jan K" }).txt, /dowiezione/);
});

test("podwykonawcy z arkusza Excel", () => {
  const L1 = L.podwykonawcyZArkusza([
    ["Lista podwykonawców"],
    ["Nazwa", "Osoba / dział", "Telefon", "Adres odbioru", "E-mail", "Osoba 2", "Telefon 2", "E-mail 2"],
    ["Firma A", "Laser", "600 000 001", "ul. Polna 1, 00-001 X", "a@example.com", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["Firma B", "", "600 000 002", "", "", "Kierownik", "600 000 003", "b2@example.com"],
  ]);
  assert.equal(L1.length, 2);
  assert.deepEqual(L1[0], { nazwa: "Firma A", dzial: "Laser", tel: "600 000 001", adres: "ul. Polna 1, 00-001 X", email: "a@example.com", osoba2: "", tel2: "", email2: "" });
  assert.equal(L1[1].tel2, "600 000 003"); assert.equal(L1[1].tel, "600 000 002");
  assert.throws(() => L.podwykonawcyZArkusza([["Coś"], ["Inne"]]), /Nazwa/);
});

test("kod projektu do wspólnego słownika", () => {
  assert.equal(L.kodProjektu("  lecm "), "LECM");
  assert.equal(L.kodProjektu("jadj1240-26a"), "JADJ1240-26A");
  assert.equal(L.kodProjektu("hala   lipa"), "HALA LIPA");
});

test("przyjęcia PZ: podwykonawca + kod, jedno PZ = jedno zlecenie, inne koszty", () => {
  const P = [{ id: "kr", nazwa: "KRAT-METAL" }, { id: "ro", nazwa: "ROLMASZ" }];
  const Z = [
    { id: "a", podw: "kr", nr: "LECM", data: "2026-10-22", odebrano: "2026-10-22", status: "Odebrane" },
    { id: "b", podw: "ro", nr: "LECM", data: "2026-10-29", status: "Zlecone" },
    { id: "c", podw: "kr", nr: "LECM", data: "2026-10-30", status: "Zlecone" },
  ];
  const rows = [
    { i: 0, pz: "PZ 1", data: "2026-10-23", dost: "KRAT-METAL SP", netto: 100, uwagi: "blachy LECM" },
    { i: 1, pz: "PZ 2", data: "2026-10-31", dost: "KRAT-METAL", netto: 50, uwagi: "LECM" },
    { i: 2, pz: "PZ 3", data: "2026-10-24", dost: "KRAT-METAL", netto: 7, uwagi: "LECM" },
    { i: 3, pz: "PZ 4", data: "2026-10-25", dost: "STALHURT", netto: 900, uwagi: "Blacha JANR1220-26B" },
    { i: 4, pz: "PZ 5", data: "2026-10-25", dost: "JACOL", netto: 9, uwagi: "śruby" },
  ];
  const r = L.dopasujPZ(rows, Z, P, {}, ["LECM"]);
  assert.deepEqual([...r.przyp].map(([k, v]) => [k, v.map(x => x.pz)]), [["a", ["PZ 1"]], ["c", ["PZ 2"]]]);
  assert.equal(r.przyp.has("b"), false);                       // zlecenie ROLMASZ nie dostaje PZ od KRAT-METAL
  assert.deepEqual(r.niedop.map(x => x.r.pz), ["PZ 3"]);         // nadmiarowe PZ czeka na ręczne przypisanie
  assert.deepEqual(r.inne.map(x => [x.r.pz, x.projekt, x.rodzaj]), [["PZ 4", "JANR1220-26B", "Blacha"]]);
  assert.deepEqual(r.pominiete.map(x => x.pz), ["PZ 5"]);
  const m = L.dopasujPZ(rows, Z, P, { 2: "b" }, ["LECM"]);      // ręczne przypisanie ma pierwszeństwo
  assert.deepEqual(m.przyp.get("b").map(x => x.pz), ["PZ 3"]);
  assert.equal(L.idKosztu("PZ 132/M01/10/2026"), "PZ-132-M01-10-2026");
});

test("kurs z kooperacji: domyślny kierowca i auto, bez awizacji", () => {
  const d = { data: "2026-11-12", nr: "LECM", rodzaj: "Blachy", opis: "#25", status: "Zlecone", doLog: true };
  const p = { nazwa: "DAR-TEST", adres: "ul. Testowa 1", bezAwizacji: true };
  const bez = L.nowyKurs("z1", d, p, { login: "jan" }, "TS", 1);
  assert.equal(bez.awizoZbedne, true);
  assert.equal(bez.kier, ""); assert.equal(bez.doUzup, true);
  const dom = { kier: "Jan Kowalski", tel: "600100200", auto: "PO 12345", kierUid: "u-jan" };
  const z = L.nowyKurs("z1", d, { nazwa: "X" }, { login: "jan" }, "TS", 1, dom);
  assert.equal(z.nasz, "Jan Kowalski"); assert.equal(z.auto, "PO 12345"); assert.equal(z.kierUid, "u-jan");
  assert.equal(z.kier, "Jan Kowalski, tel. 600100200 | PO 12345");
  assert.equal(z.doUzup, false); assert.equal(z.awizoZbedne, false);
  const u = L.zmianyKursu({ status: "Oczekuje na kierowcę" }, d, { podw: ["a", "b"] }, p, { login: "jan" }, "TS");
  assert.equal(u.awizoZbedne, true);
});
