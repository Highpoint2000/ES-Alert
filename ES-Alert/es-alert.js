/* ===================================================================== *
 *  ES‑Alert‑Plugin  –  Version 1.0                                       *
 * ===================================================================== *
 *  – holt minütlich die JSON‑Datei zur OMID 8032                         *
 *  – zeigt Toasts & spielt optional einen Beep‑Alarm                     *
 *  – Audio wird erst nach erster Nutzer‑Interaktion freigeschaltet       *
 *  – prüft beim Start auf neue Plugin‑Version                            *
 * ===================================================================== */

/* ==== Plugin‑Konstanten ============================================= */
const OMID            = '8032';            // nur die Zahl!
const maxAgeMinutes   = 7200;              // 5 Tage in Minuten
const useLocalTime    = true;              // true = Ortszeit, false = UTC
const playAlertSound  = true;              // false = Ton unterdrücken

const plugin_version  = '1.0';
const plugin_path     = 'https://raw.githubusercontent.com/highpoint2000/ES-Alert/';
const plugin_JSfile   = 'main/ES-Alert/es-alert.js';
const plugin_name     = 'ES-Alert';
const PluginUpdateKey = `${plugin_name}_lastUpdateNotification`;   // localStorage‑Key

/* ==== Sound‑Optionen ============================================== */
const alertSoundUrl  = `${location.protocol}//${location.host}/sound/alarm.mp3`;
const alertAudio     = new Audio(alertSoundUrl);
let   audioUnlocked  = false;

function unlockAudio() {
  if (audioUnlocked || !playAlertSound) return;
  alertAudio.play()
    .then(() => { alertAudio.pause(); audioUnlocked = true; })
    .catch(() => {/* Autoplay noch blockiert */});
}
window.addEventListener('click',  unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

/* ==== Laufzeit‑Variablen =========================================== */
let lastShownTimestamp = null;                               // zuletzt gezeigter Alert
let AlertActive        = JSON.parse(localStorage.getItem('ESAlertActive') || 'true');
let alertIntervalId    = null;                               // ID des setInterval‑Timers
const corsAnywhereUrl  = 'https://cors-proxy.de:13128/';      // CORS‑Proxy

/* ==== Hilfsfunktionen ============================================= */
function startAlertTimer() {
  if (alertIntervalId === null) {
    fetchOmidData();                                         // sofortiger Abruf
    alertIntervalId = setInterval(fetchOmidData, 60_000);
    console.log(`${plugin_name}: Timer gestartet.`);
  }
}
function stopAlertTimer() {
  if (alertIntervalId !== null) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
    console.log(`${plugin_name}: Timer gestoppt.`);
  }
}
function formatTimestamp(rfc) {
  if (!rfc) return '';
  const d = new Date(rfc);
  return useLocalTime ? d.toLocaleString() : d.toUTCString();
}

/* ------------------------------------------------------------------ *
 *  VERSION‑CHECK                                                     *
 * ------------------------------------------------------------------ */
function shouldShowNotification() {
  const last = parseInt(localStorage.getItem(PluginUpdateKey) || '0', 10);
  const now  = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (now - last > ONE_DAY) {
    localStorage.setItem(PluginUpdateKey, now.toString());
    return true;
  }
  return false;
}

// vergleicht numerische & alphanumerische Versionen (z. B. 1.2a < 1.2b < 1.3)
function compareVersions(local, remote) {
  const parse = v => v.split(/(\d+|[a-z]+)/i).filter(Boolean)
                      .map(p => (isNaN(p) ? p : parseInt(p, 10)));
  const a = parse(local), b = parse(remote);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1;
    if (typeof x === 'string' && typeof y === 'string') return x > y ? 1 : -1;
    return typeof x === 'number' ? -1 : 1;                 // Zahl < Buchstabe
  }
  return 0;
}

// lädt externes Skript, extrahiert plugin_version & vergleicht
function checkplugin_version() {
  fetch(`${plugin_path}${plugin_JSfile}`)
    .then(r => r.text())
    .then(src => {
      const m = src.match(/const\s+plugin_version\s*=\s*'([\d.]+[a-z]*)?';/i);
      if (!m) {
        console.error(`${plugin_name}: Plugin version not found im externen Skript.`);
        return;
      }
      const extVer = m[1] || '0';
      const cmp    = compareVersions(plugin_version, extVer);

      if (cmp ===  1) {
        console.log(`${plugin_name}: lokale Version (${plugin_version}) ist neuer als extern.`);
      } else if (cmp === -1) {
        if (shouldShowNotification()) {
          console.log(`${plugin_name}: Update verfügbar: ${plugin_version} → ${extVer}`);
          sendToast('warning important', plugin_name,
            `Update available:<br>${plugin_version} → ${extVer}`, false, false);
        }
      } else {
        console.log(`${plugin_name}: Version aktuell (${plugin_version}).`);
      }
    })
    .catch(e => console.error(`${plugin_name}: Fehler beim Laden der Versionsinfo:`, e));
}

/* ---- JSON‑Abruf + Toast‑/Sound‑Logik ------------------------------ */
async function fetchOmidData() {
  const apiUrl     = `https://www.fmlist.org/esapi/es${OMID}.json`;
  const requestUrl = `${corsAnywhereUrl}${apiUrl}`;

  try {
    const r = await fetch(requestUrl);

    if (r.status === 404) {
      sendToast('warning important', 'ES Alert',
                'Keine Information für die eingestellte OMID vorhanden.', false, false);
      return;
    }
    if (!r.ok) {
      sendToast('error important', 'ES Alert',
                `Fehler beim Abruf: ${r.status} ${r.statusText}`, false, false);
      return;
    }

    const { esalert = {} } = await r.json();
    const { esdatetime: ts, directions = [] } = esalert;

    if (!ts) {
      sendToast('error important', 'ES Alert',
                'Ungültiger Alert‑Datensatz.', false, false);
      return;
    }

    const diffMin = (Date.now() - Date.parse(ts)) / 60000;
    if (diffMin <= maxAgeMinutes && ts !== lastShownTimestamp) {
      const tsStr = formatTimestamp(ts);
      sendToast('warning important', 'ES Alert',
        `The following directions might work: ${directions.join(' ')}. `
        + `This Alert has been generated at ${tsStr}`,
        true, false);                                      // wichtiger Toast

      if (playAlertSound && audioUnlocked) {
        alertAudio.currentTime = 0;
        alertAudio.play().catch(() => {});
      }
      lastShownTimestamp = ts;
    }

  } catch (err) {
    sendToast('error important', 'ES Alert',
              `Netzwerk‑ oder Parse‑Fehler: ${err.message}`, false, false);
  }
}

/* ==== Button zum Ein/Aus‑Schalten der Alerts ====================== */
(function createAlertToggle(buttonId) {
  (function waitForPanel() {
    const maxWait = 10_000;
    let   ready   = false;

    const obs = new MutationObserver(() => {
      if (typeof addIconToPluginPanel === 'function') {
        obs.disconnect(); ready = true;

        addIconToPluginPanel(
          buttonId, 'ES Alert', 'solid', 'bell',
          `Plugin Version: ${plugin_version}`
        );

        const btnObs = new MutationObserver(() => {
          const $btn = $(`#${buttonId}`);
          if ($btn.length) {
            btnObs.disconnect();
            $btn.addClass('hide-phone bg-color-2');
            if (AlertActive) { $btn.addClass('active'); startAlertTimer(); }

            let isLong = false, t;
            $btn.on('mousedown', () => { isLong = false; t = setTimeout(() => isLong = true, 300); });
            $btn.on('mouseup', () => {
              clearTimeout(t);
              if (!isLong) {
                AlertActive = !AlertActive;
                localStorage.setItem('ESAlertActive', JSON.stringify(AlertActive));
                lastShownTimestamp = null;

                if (AlertActive) {
                  $btn.addClass('active');
                  unlockAudio();
                  startAlertTimer();
                } else {
                  $btn.removeClass('active');
                  stopAlertTimer();
                }
              }
            });
            $btn.on('mouseleave', () => clearTimeout(t));
          }
        });
        btnObs.observe(document.body, { childList: true, subtree: true });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      if (!ready) console.error(`${plugin_name}: addIconToPluginPanel nicht gefunden.`);
    }, maxWait);
  })();

  const css = `
    #${buttonId}:hover { color: var(--color-5); filter: brightness(120%); }
    #${buttonId}.active { background-color: var(--color-2) !important; filter: brightness(120%); }
  `;
  $('<style>').prop('type', 'text/css').html(css).appendTo('head');
})('ES-ALERT-on-off');

/* ==== Plugin‑Version sofort prüfen (nach kleinem Delay) ============ */
setTimeout(checkplugin_version, 2500);
