/* Ekran startowy systemu SteelFlow (wspólny dla Truck App, Kooperacji, Zapytań i Kombajnu Zakupowca):
   kafelek w kolorze modułu, przekrój dwuteownika, przepływ (żółta strzałka), nazwa SteelFlow + nazwa modułu, „made by M.K.”.
   Ok. 2,4 s, kliknięcie pomija. Bez bibliotek – działa od razu, także bez internetu. Raz na kartę przeglądarki.
   Użycie: pierwszy skrypt na początku body, z atrybutami data-modul (nazwa) i data-kolor (kolor kafelka), np.
   data-modul="Kooperacje" data-kolor="#1f5f7a". Wersja dla Truck App: src/steelflow.js (ten sam wygląd). */
(function () {
  if (window.__sfSplash) return; window.__sfSplash = true;
  var skr = document.currentScript || {}, ds = skr.dataset || {};
  var MODUL = ds.modul || 'logistyka · zakupy · kooperacje', KOLOR = /^#[0-9a-f]{6}$/i.test(ds.kolor || '') ? ds.kolor : '#1f3864';
  if (/[?&]emu\b/.test(location.search)) return;   // testy ekranowe na emulatorze bazy – bez ekranu startowego
  try { if (!window.Capacitor && sessionStorage.getItem('sf-splash')) return; sessionStorage.setItem('sf-splash', '1'); } catch (e) { /* */ }
  var css = `
#sf-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  background:#f2f3f1;cursor:pointer;animation:sf-out .45s ease 2.05s forwards}
@media (prefers-color-scheme:dark){#sf-splash{background:#12161b}}
#sf-splash .sf-tile{width:150px;height:150px;animation:sf-pop .45s cubic-bezier(.2,.9,.3,1.25) both}
#sf-splash svg{width:100%;height:100%;display:block;overflow:visible}
#sf-splash .belka{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0);animation:sf-grow .38s cubic-bezier(.3,1.3,.5,1) .3s forwards}
#sf-splash .tor{stroke-dasharray:100;stroke-dashoffset:100;animation:sf-draw .5s ease-in-out .62s forwards}
#sf-splash .grot{transform-box:fill-box;transform-origin:30% 50%;transform:scale(0);animation:sf-pop2 .22s cubic-bezier(.2,.9,.3,1.5) 1.08s forwards}
#sf-splash .sf-t{font:700 32px "IBM Plex Sans Condensed","Barlow Semi Condensed","Arial Narrow",Arial,sans-serif;letter-spacing:.02em;color:#1f3864;text-align:center;
  opacity:0;transform:translateY(10px);animation:sf-up .4s ease-out 1.12s forwards}
#sf-splash .sf-t b{color:#b98b00;font-weight:700}
#sf-splash .sf-t small{display:block;margin-top:2px;font-size:11.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#5b6270}
#sf-splash .sf-mk{position:absolute;bottom:max(22px,env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:8px;
  font:500 12px "IBM Plex Sans",system-ui,sans-serif;letter-spacing:.06em;color:#5b6270;opacity:0;animation:sf-fade .4s ease 1.4s forwards}
#sf-splash .sf-mk svg{width:58px;height:auto}
@media (prefers-color-scheme:dark){#sf-splash .sf-t{color:#e3e8ee}#sf-splash .sf-t small,#sf-splash .sf-mk{color:#9aa3ad}#sf-splash .sf-mk text{fill:#e3e8ee}#sf-splash .sf-t b{color:#f2b705}#sf-splash .sf-mk .mk-i{fill:#f2b705}}
@keyframes sf-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@keyframes sf-pop2{to{transform:scale(1)}}
@keyframes sf-grow{to{transform:scaleY(1)}}
@keyframes sf-draw{to{stroke-dashoffset:0}}
@keyframes sf-up{to{transform:none;opacity:1}}
@keyframes sf-fade{to{opacity:1}}
@keyframes sf-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){#sf-splash *{animation:none!important;opacity:1!important;transform:none!important;stroke-dashoffset:0!important}
  #sf-splash{animation:sf-out .3s ease .6s forwards!important}}`;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var tor = 'M78 352C168 352 196 256 256 256S344 166 404 166';
  var el = document.createElement('div'); el.id = 'sf-splash'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="sf-tile"><svg viewBox="0 0 512 512">' +
    '<rect width="512" height="512" rx="104" fill="' + KOLOR + '"/>' +
    '<path class="belka" fill="#fff" d="M150 112h212v42h-82v204h82v42H150v-42h82V154h-82z"/>' +
    '<path class="tor" pathLength="100" d="' + tor + '" fill="none" stroke="' + KOLOR + '" stroke-width="54" stroke-linecap="round"/>' +
    '<path class="tor" pathLength="100" d="' + tor + '" fill="none" stroke="#f2b705" stroke-width="30" stroke-linecap="round"/>' +
    '<path class="grot" d="M396 126l64 40-64 40z" fill="#f2b705" stroke="' + KOLOR + '" stroke-width="10" stroke-linejoin="round" paint-order="stroke"/>' +
    '</svg></div><div class="sf-t">Steel<b>Flow</b><small>' + MODUL.replace(/[<>&"]/g, '') + '</small></div>' +
    '<div class="sf-mk"><svg viewBox="0 0 300 110"><path class="mk-i" fill="#c99a00" d="M14 14h66v16H56v50h24v16H14V80h24V30H14z"/>' +
    '<text x="100" y="82" font-family="IBM Plex Sans Condensed,Barlow Semi Condensed,Arial Narrow,Arial,sans-serif" font-weight="700" font-size="78" letter-spacing="2" fill="#1b2028">M.K.</text></svg>made by M.K.</div>';
  (document.body || document.documentElement).appendChild(el);
  var usun = function () { if (el.parentNode) el.parentNode.removeChild(el); if (st.parentNode) st.parentNode.removeChild(st); };
  el.addEventListener('click', usun);
  el.addEventListener('animationend', function (e) { if (e.target === el && e.animationName === 'sf-out') usun(); });
  setTimeout(usun, 3200);   // zabezpieczenie, gdyby animacje były wyłączone
})();
