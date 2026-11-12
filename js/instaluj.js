/* Instalacja aplikacji na telefonie/komputerze – wybór użytkownika:
   • aplikacja z Chrome (PWA): instaluje się ze strony, aktualizuje się sama, bez pobierania plików,
   • APK (Android): osobny plik do pobrania (jeśli aplikacja go ma; atrybut data-apk).
   Rejestruje też sw.js (szybsze uruchamianie, ekran zastępczy bez sieci).
   Użycie: <script src="js/instaluj.js" data-nazwa="Kooperacje" data-apk="https://…/Kooperacje.apk"></script>
   oraz przycisk z atrybutem data-instaluj (pokazuje się sam, gdy aplikacja nie jest jeszcze zainstalowana). */
(function () {
  var skr = document.currentScript || {}, ds = skr.dataset || {};
  var NAZWA = ds.nazwa || document.title, APK = ds.apk || "";
  var zdarzenie = null;
  var natywna = function () { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); };
  var zainstalowana = function () { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
  var iOS = function () { return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); };
  var android = function () { return /Android/i.test(navigator.userAgent); };

  if (!natywna() && "serviceWorker" in navigator && location.protocol === "https:")
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); zdarzenie = e; pokazPrzyciski(); });
  window.addEventListener("appinstalled", function () { zdarzenie = null; pokazPrzyciski(); });

  function pokazPrzyciski() {
    var widac = !natywna() && !zainstalowana();
    document.querySelectorAll("[data-instaluj]").forEach(function (b) { b.hidden = !widac; b.onclick = okno; });
  }
  var css = "#inst-ov{position:fixed;inset:0;z-index:9000;background:rgba(10,16,28,.55);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#inst-ov .w{background:#fff;color:#1b2028;border-radius:14px;max-width:440px;width:100%;padding:18px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.3)}" +
    "#inst-ov h3{margin:0 0 10px;font-size:18px}#inst-ov .op{display:block;width:100%;text-align:left;border:1px solid #d2d6cf;border-radius:10px;padding:12px;margin:8px 0;background:#f8f9f7;cursor:pointer;font:inherit;color:inherit}" +
    "#inst-ov .op b{display:block;font-size:15px}#inst-ov .op small{color:#5b6270}#inst-ov ol{margin:6px 0 0;padding-left:20px}#inst-ov .x{margin-top:8px;border:0;background:none;color:#5b6270;cursor:pointer;font:inherit}" +
    "@media (prefers-color-scheme:dark){#inst-ov .w{background:#1a2028;color:#e3e8ee}#inst-ov .op{background:#12161b;border-color:#2c3540}#inst-ov .op small{color:#9aa3ad}}";
  function okno() {
    if (document.getElementById("inst-ov")) return;
    if (!document.getElementById("inst-css")) { var st = document.createElement("style"); st.id = "inst-css"; st.textContent = css; document.head.appendChild(st); }
    var kroki = iOS()
      ? "<ol><li>Otwórz tę stronę w <b>Safari</b>.</li><li>Dotknij <b>Udostępnij</b> (kwadrat ze strzałką).</li><li>Wybierz <b>Do ekranu początkowego</b>.</li></ol>"
      : "<ol><li>Otwórz menu przeglądarki <b>⋮</b> (prawy górny róg).</li><li>Wybierz <b>Zainstaluj aplikację</b> albo <b>Dodaj do ekranu głównego</b>.</li></ol>";
    var w = document.createElement("div"); w.id = "inst-ov";
    w.innerHTML = '<div class="w" role="dialog" aria-modal="true"><h3>📲 Zainstaluj ' + NAZWA.replace(/[<>&"]/g, "") + "</h3>" +
      '<button class="op" type="button" data-o="pwa"><b>Aplikacja z przeglądarki (polecana)</b><small>Instaluje się w kilka sekund, aktualizuje się sama – nie trzeba nic pobierać ponownie. Działa na telefonie i komputerze.</small></button>' +
      (APK && !iOS() ? '<button class="op" type="button" data-o="apk"><b>Plik APK (Android)</b><small>Klasyczna aplikacja na Androida. Nowe wersje funkcji też przychodzą same; nowy plik trzeba pobrać tylko przy zmianach samej aplikacji Android.</small></button>' : "") +
      '<div id="inst-kroki" hidden></div><button class="x" type="button">Zamknij</button></div>';
    document.body.appendChild(w);
    var zamk = function () { w.remove(); };
    w.querySelector(".x").onclick = zamk; w.onclick = function (e) { if (e.target === w) zamk(); };
    w.querySelector('[data-o="pwa"]').onclick = function () {
      if (zdarzenie) { zdarzenie.prompt(); zdarzenie.userChoice.then(function () { zdarzenie = null; pokazPrzyciski(); }, function () {}); zamk(); return; }
      var k = w.querySelector("#inst-kroki"); k.hidden = false; k.innerHTML = "<p style=\"margin:8px 0 0\">Przeglądarka nie pokazała okna instalacji – zrób to ręcznie:</p>" + kroki;
    };
    var a = w.querySelector('[data-o="apk"]'); if (a) a.onclick = function () { location.href = APK; zamk(); };
  }
  window.instalujAplikacje = okno;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pokazPrzyciski); else pokazPrzyciski();
  setInterval(pokazPrzyciski, 3000);   // przyciski rysowane później przez aplikację (logowanie, nagłówek)
})();
