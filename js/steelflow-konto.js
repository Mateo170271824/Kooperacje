/* SteelFlow – wspólny moduł logowania i bazy (wersja 1)
   Jedno źródło: repo Logistyka, plik wspolne/steelflow-konto.js. Aplikacje (Kooperacje, Zapytania ofertowe,
   Kombajn Zakupowca) mają jego DOKŁADNĄ kopię w js/steelflow-konto.js – zmieniaj tylko tutaj i kopiuj:
   node wspolne/kopiuj.mjs  (sprawdza też, czy kopie są aktualne).
   Moduł nie importuje Firebase – aplikacja podaje swoje SDK (Truck App: z npm, pozostałe: z gstatic). */

export const WERSJA = 1;
export const FIREBASE_SDK = '10.12.2';   // wersja SDK ładowana z gstatic (Kooperacje, Zapytania, Kombajn)

// Konfiguracja aplikacji internetowej nie jest tajna – dostępu do danych pilnują reguły bazy (firestore.rules w repo Logistyka).
export const firebaseConfig = {
  apiKey: 'AIzaSyB8Zi3CTsEJDqnxpt2EpmEN0JKbQZkx9Ik',
  authDomain: 'logistyka-app-41d7a.firebaseapp.com',
  projectId: 'logistyka-app-41d7a',
  storageBucket: 'logistyka-app-41d7a.firebasestorage.app',
  messagingSenderId: '730726420764',
  appId: '1:730726420764:web:fbd4a12acd2b5ebdb52ad9'
};

// Adresy aplikacji systemu (linki między modułami)
export const APLIKACJE = {
  truck: 'https://logistyka-app-41d7a.web.app',
  koop: 'https://mateo170271824.github.io/Kooperacje/',
  zap: 'https://mateo170271824.github.io/Zapytania-ofertowe/',
  kombajn: 'https://kombajn-zakupowca.web.app'
};

// Login → techniczny adres e-mail konta Firebase (nikt na niego nic nie wysyła). Ten sam login działa we wszystkich aplikacjach.
export const DOMENA = 'konta.' + firebaseConfig.authDomain;
export const normLogin = s => String(s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
  .replace(/[^a-z0-9._-]+/g, '.').replace(/^\.+|\.+$/g, '');
export const emailZLoginu = login => normLogin(login) + '@' + DOMENA;
export const loginZEmaila = email => String(email || '').split('@')[0];

// Komunikat dla człowieka zamiast kodu błędu Firebase (logowanie i zapis)
const KOMUNIKATY = {
  'auth/invalid-credential': 'Zły login albo hasło.',
  'auth/wrong-password': 'Zły login albo hasło.',
  'auth/user-not-found': 'Nie ma takiego loginu.',
  'auth/invalid-email': 'Login zawiera niedozwolone znaki.',
  'auth/missing-password': 'Wpisz hasło.',
  'auth/user-disabled': 'To konto jest wyłączone. Zapytaj administratora.',
  'auth/too-many-requests': 'Za dużo prób. Odczekaj kilka minut.',
  'auth/network-request-failed': 'Brak internetu. Sprawdź połączenie i spróbuj ponownie.',
  'permission-denied': 'Brak uprawnień do tej operacji.',
  'unavailable': 'Brak połączenia z bazą – spróbuj za chwilę.'
};
export function komunikat(e) {
  const c = (e && e.code) || '';
  return KOMUNIKATY[c] || KOMUNIKATY[c.replace(/^firestore\//, '')] || 'Coś poszło nie tak' + (c ? ` (${c})` : '') + '.';
}

// Tryb testowy: emulator Firebase na tym komputerze – tylko na localhost, z ?emu w adresie albo flagą w localStorage.
export function trybEmulatora(loc = globalThis.location, ls = globalThis.localStorage) {
  if (!loc || !['localhost', '127.0.0.1'].includes(loc.hostname)) {
    try { if (ls && ls.getItem('skavska-emulator') === '1') return true; } catch (e) { /* brak dostępu */ }
    return false;
  }
  if (new URLSearchParams(loc.search || '').has('emu')) return true;
  try { return !!ls && ls.getItem('skavska-emulator') === '1'; } catch (e) { return false; }
}

// Połączenie z bazą. sdk = { initializeApp, auth: moduł firebase-auth, firestore: moduł firebase-firestore }.
// opcje: { emuPort: port emulatora bazy (8080), projektEmu: id projektu w emulatorze, auth/firestore: własne ustawienia }
export function polacz(sdk, opcje = {}) {
  const emu = opcje.emulator ?? trybEmulatora();
  const app = sdk.initializeApp(emu && opcje.projektEmu ? { ...firebaseConfig, projectId: opcje.projektEmu } : firebaseConfig, opcje.nazwa);
  const auth = opcje.auth ? sdk.auth.initializeAuth(app, opcje.auth) : sdk.auth.getAuth(app);
  const db = opcje.firestore ? sdk.firestore.initializeFirestore(app, opcje.firestore) : sdk.firestore.getFirestore(app);
  if (emu) {
    sdk.auth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    sdk.firestore.connectFirestoreEmulator(db, '127.0.0.1', opcje.emuPort || 8080);
  }
  return { app, auth, db, emulator: emu };
}
// Kooperacje, Zapytania i Kombajn: SDK z gstatic (bez budowania)
export async function zaladujSDK(v = FIREBASE_SDK) {
  const u = n => `https://www.gstatic.com/firebasejs/${v}/firebase-${n}.js`;
  const [a, auth, firestore] = await Promise.all([import(u('app')), import(u('auth')), import(u('firestore'))]);
  return { initializeApp: a.initializeApp, auth, firestore };
}
export const zaloguj = (sdk, auth, login, haslo) => sdk.auth.signInWithEmailAndPassword(auth, emailZLoginu(login), String(haslo || '').trim());

// Zastępstwa (Zapytania, Kombajn): z.od – początek, z.do – początek dnia PO ostatnim dniu, z.odwolano – odebrane wcześniej
const naDate = x => !x ? null : x.toDate ? x.toDate() : new Date(x);
export function zastStatus(z, teraz = Date.now()) {
  if (!z) return 'brak';
  if (z.odwolano) return 'odwołane';
  const od = naDate(z.od)?.getTime(), d = naDate(z.do)?.getTime();
  if (!(od >= 0) || !(d >= 0)) return 'brak';
  return teraz < od ? 'zaplanowane' : teraz >= d ? 'zakończone' : 'aktywne';
}
// ostatni dzień zastępstwa (RRRR-MM-DD)
export function zastDoDnia(z) {
  const d = new Date(naDate(z.do).getTime() - 864e5), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Dostęp do aplikacji prywatnej (właściciel + zastępcy): { ok, wlasciciel, zast, powod }
export function dostepWlasciciela(uid, adminUid, dostep, teraz = Date.now()) {
  if (uid && uid === adminUid) return { ok: true, wlasciciel: true, zast: null };
  const z = dostep?.zastepcy?.[uid];
  const s = zastStatus(z, teraz);
  if (s === 'aktywne') return { ok: true, wlasciciel: false, zast: z };
  return { ok: false, wlasciciel: false, zast: null, powod: s, od: s === 'zaplanowane' ? naDate(z.od) : null };
}
// Konto biura z dostępem do modułu (Kooperacje): { ok, admin, powod }
export function dostepBiura(uid, konto, adminUid, flaga) {
  const admin = !!uid && uid === adminUid;
  if (!konto) return { ok: false, admin, powod: 'To konto nie ma dostępu do aplikacji.' };
  if (konto.rola !== 'biuro') return { ok: false, admin, powod: 'Ten moduł jest dostępny tylko dla kont biura.' };
  if (konto.aktywny === false) return { ok: false, admin, powod: 'To konto jest zablokowane w Truck App.' };
  if (flaga && konto[flaga] === false && !admin) return { ok: false, admin, powod: 'To konto nie ma dostępu do tego modułu. Dostęp nadaje administrator.' };
  return { ok: true, admin };
}
