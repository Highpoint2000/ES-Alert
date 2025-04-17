(() => {
  ////////////////////////////////////////////////////////
  ///                                                  ///
  ///  ES ALERT SCRIPT FOR FM-DX-WEBSERVER (V1.0)      ///
  ///                                                  ///
  ///  by Highpoint          last update: 06.03.25     ///
  ///                                                  ///
  ///  https://github.com/Highpoint2000/ES-Alert       ///
  ///                                                  ///
  ////////////////////////////////////////////////////////

/* ==== Global constants ================================================= */
const OMID               = '1234';          // Enter the valid FMLIST OMID here, e.g. '1234'
const LAST_ALERT_MINUTES = 15;              // Enter the time in minutes for displaying the last message when loading the page (default is 15)
const USE_LOCAL_TIME     = true;            // To display in UTC/GMT, set this value to true
const PLAY_ALERT_SOUND   = true;            // If you want a sound to play when receiving a notification, set this variable to true. Also, copy the alert.mp3 file to the ...\web\sound directory of the web server. The \sound folder still needs to be created.

const PLUGIN_VERSION    = '1.0';
const PLUGIN_PATH       = 'https://raw.githubusercontent.com/highpoint2000/ES-Alert/';
const PLUGIN_JS_FILE    = 'main/ES-Alert/es-alert.js';
const PLUGIN_NAME       = 'ES-Alert';
const UPDATE_KEY        = `${PLUGIN_NAME}_lastUpdateNotification`;   // localStorage key

/* ==== Sound options ==================================================== */
const alertSoundUrl = `${location.protocol}//${location.host}/sound/alert.mp3`;
const alertAudio    = new Audio(alertSoundUrl);

let audioUnlocked = false;                      // becomes true after first gesture
function unlockAudio() {
  if (audioUnlocked || !PLAY_ALERT_SOUND) return;
  alertAudio.play()
    .then(() => { alertAudio.pause(); audioUnlocked = true; })
    .catch(() => { /* autoplay still blocked – will try again on next click */ });
}
window.addEventListener('click',  unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

/* ==== Runtime state ==================================================== */
let lastShownTimestamp = null;                 // to avoid duplicate toasts
let ALERT_ACTIVE       = JSON.parse(localStorage.getItem('ESAlertActive') || 'true');
let alertIntervalId    = null;                 // setInterval handle

let isAdminLoggedIn      = false;              // “You are logged in as an administrator.”
let isTuneLoggedIn       = false;              // “You are logged in and can control the receiver.”
let isTuneAuthenticated  = false;              // true if either admin or tune
const CORS_PROXY_URL     = 'https://cors-proxy.de:13128/';

/* ===================================================================== *
 *  Admin / Tune mode detection                                          *
 * ===================================================================== */
function checkAdminMode() {
  const txt = document.body.textContent || document.body.innerText;
  isAdminLoggedIn = txt.includes('You are logged in as an administrator.') ||
                    txt.includes('You are logged in as an adminstrator.');
  isTuneLoggedIn  = txt.includes('You are logged in and can control the receiver.');

  if (isAdminLoggedIn) {
    console.log(`${PLUGIN_NAME}: admin mode detected – authentication ok.`);
    isTuneAuthenticated = true;
  } else if (isTuneLoggedIn) {
    console.log(`${PLUGIN_NAME}: tune mode detected – authentication ok.`);
    isTuneAuthenticated = true;
  } else {
    console.log(`${PLUGIN_NAME}: user is not authenticated as admin/tune.`);
  }
}
checkAdminMode();

/* ===================================================================== *
 *  Version check (only for authenticated users)                         *
 * ===================================================================== */
function shouldShowUpdateToast() {
  const last  = parseInt(localStorage.getItem(UPDATE_KEY) || '0', 10);
  const now   = Date.now();
  const DAY   = 86_400_000;                  // 24 h
  if (now - last > DAY) {
    localStorage.setItem(UPDATE_KEY, now.toString());
    return true;
  }
  return false;
}

function compareVersions(a, b) {             // 1.3a < 1.3 < 1.3b < 1.4
  const parts = v => v.split(/(\d+|[a-z]+)/i).filter(Boolean)
                      .map(p => (isNaN(p) ? p : parseInt(p, 10)));
  const A = parts(a), B = parts(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0, y = B[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1;
    if (typeof x === 'string' && typeof y === 'string') return x > y ? 1 : -1;
    return typeof x === 'number' ? -1 : 1;   // numeric < alphabetic
  }
  return 0;
}

function checkPluginVersion() {
  if (!isTuneAuthenticated) return;          // only admins/tune users
  fetch(`${PLUGIN_PATH}${PLUGIN_JS_FILE}`)
    .then(r => r.text())
    .then(src => {
      const m = src.match(/const\s+PLUGIN_VERSION\s*=\s*'([\d.]+[a-z]*)?';/i);
      if (!m) return;
      const remoteVer = m[1] || '0';
      const cmp = compareVersions(PLUGIN_VERSION, remoteVer);
      if (cmp === -1 && shouldShowUpdateToast()) {
        console.log(`${PLUGIN_NAME}: update available ${PLUGIN_VERSION} → ${remoteVer}`);
        sendToast(
          'warning',
          PLUGIN_NAME,
          `Update available:<br>${PLUGIN_VERSION} → ${remoteVer}`,
          false,
          false
        );
      }
    })
    .catch(e => console.error(`${PLUGIN_NAME}: version check failed:`, e));
}
setTimeout(checkPluginVersion, 2500);

/* ===================================================================== *
 *  Helper functions                                                     *
 * ===================================================================== */
function startAlertTimer() {
  if (alertIntervalId === null) {
    fetchOmidData();                                      // immediate fetch
    alertIntervalId = setInterval(fetchOmidData, 60_000);
  }
}
function stopAlertTimer() {
  if (alertIntervalId !== null) {
    clearInterval(alertIntervalId);
    alertIntervalId = null;
  }
}
function fmtTS(rfc) {
  if (!rfc) return '';
  const d = new Date(rfc);
  return USE_LOCAL_TIME ? d.toLocaleString() : d.toUTCString();
}

/* ===================================================================== *
 *  Fetch ES‑alert JSON + toast / sound                                  *
 * ===================================================================== */
async function fetchOmidData() {
  const url = `${CORS_PROXY_URL}https://www.fmlist.org/esapi/es${OMID}.json`;
  try {
    const r = await fetch(url);

    if (r.status === 404) {
      sendToast('warning', 'ES Alert', 'No information available for the configured OMID.', false, false);
      return;
    }
    if (!r.ok) {
      sendToast('error important', 'ES Alert', `HTTP error: ${r.status} ${r.statusText}`, false, false);
      return;
    }

    const { esalert = {} } = await r.json();
    const { esdatetime: ts, directions = [] } = esalert;
    if (!ts) {
      sendToast('error important', 'ES Alert', 'Invalid alert data set.', false, false);
      return;
    }

    const ageMin = (Date.now() - Date.parse(ts)) / 60000;
    if (ageMin <= LAST_ALERT_MINUTES && ts !== lastShownTimestamp) {
      const tStr = fmtTS(ts);
      sendToast(
        'warning important',
        'ES Alert',
        `The following directions might work: ${directions.join(' ')}. `+`This Alert has been generated at ${tStr}`,
        true,
        false
      );

      if (PLAY_ALERT_SOUND && audioUnlocked) {
        alertAudio.currentTime = 0;
        alertAudio.play().catch(() => {});
      }
      lastShownTimestamp = ts;
    }

  } catch (e) {
    sendToast('error', 'ES Alert', `Network or parse error: ${e.message}`, false, false);
  }
}

/* ===================================================================== *
 *  Toggle button (only admin/tune may switch)                           *
 * ===================================================================== */
(function createToggle(id) {
  (function waitForPanel() {
    const obs = new MutationObserver(() => {
      if (typeof addIconToPluginPanel === 'function') {
        obs.disconnect();

        addIconToPluginPanel(id, 'ES Alert', 'solid', 'bell', `Plugin Version: ${PLUGIN_VERSION}`);

        const btnObs = new MutationObserver(() => {
          const $btn = $(`#${id}`);
          if (!$btn.length) return;

          btnObs.disconnect();
          $btn.addClass('hide-phone bg-color-2');
          if (ALERT_ACTIVE) { $btn.addClass('active'); startAlertTimer(); }

          let isLong = false, t;
          $btn.on('mousedown', () => { isLong = false; t = setTimeout(() => isLong = true, 300); });

          $btn.on('mouseup', () => {
            clearTimeout(t);
            if (isLong) return;

            // --- Only authenticated users may toggle -----------------
            if (!isTuneAuthenticated) {
              sendToast(
                'warning',
                'ES Alert',
                'You must be authenticated as admin to use this feature!',
                false,
                false
              );
              return;
            }

            ALERT_ACTIVE = !ALERT_ACTIVE;
            localStorage.setItem('ESAlertActive', JSON.stringify(ALERT_ACTIVE));
            lastShownTimestamp = null;

            if (ALERT_ACTIVE) {
              $btn.addClass('active');
              unlockAudio();
              startAlertTimer();
            } else {
              $btn.removeClass('active');
              stopAlertTimer();
            }
          });

          $btn.on('mouseleave', () => clearTimeout(t));
        });
        btnObs.observe(document.body, { childList: true, subtree: true });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  })();

  /* Styles for hover / active state */
  const css = `
    #${id}:hover { color: var(--color-5); filter: brightness(120%); }
    #${id}.active { background-color: var(--color-2) !important; filter: brightness(120%); }
  `;
  $('<style>').prop('type', 'text/css').html(css).appendTo('head');
})('ES-ALERT-on-off');
})();
