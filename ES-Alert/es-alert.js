(() => {
  ////////////////////////////////////////////////////////
  ///                                                  ///
  ///  ES ALERT SCRIPT FOR FM‑DX WEBSERVER (V1.2)      ///
  ///                                                  ///
  ///  by Highpoint           last update 24.04.2025   ///
  ///                                                  ///
  ///  https://github.com/Highpoint2000/ES-Alert       ///
  ///                                                  ///
  ////////////////////////////////////////////////////////

  /* ==== ES Alert Options ================================================= */
  const OMID               = '1234';   // Enter the valid FMLIST OMID here, e.g. '1234'
  const LAST_ALERT_MINUTES = 15;       // Enter the time in minutes for displaying the last message when loading the page (default is 15)
  const USE_LOCAL_TIME     = true;    // To display in UTC/GMT, set this value to true
  const PLAY_ALERT_SOUND   = true;    // If you want a sound to play when receiving a notification, set this variable to true. Also, copy the alert.mp3 file frome the plugin folder to the ...\web\sound directory of the fmdx web server. The \sound folder still needs to be created.
   /* ==== ES Status Display Options  =================================================== */
  const ES_STATUS_ENABLED = true;     // true = display on, false = display off
  const SELECTED_REGION = 'EU';       // Options: 'EU', 'NA', 'AU'

  /* ==== Global variables  =================================================== */

  const PLUGIN_VERSION  = '1.2';
  const PLUGIN_PATH     = 'https://raw.githubusercontent.com/highpoint2000/ES-Alert/';
  const API_URL 		= 'https://fmdx.org/includes/tools/get_muf.php';
  const CORS_PROXY_URL  = 'https://cors-proxy.de:13128/';
  const PLUGIN_JS_FILE  = 'main/ES-Alert/es-alert.js';
  const PLUGIN_NAME     = 'ES-Alert';
  const UPDATE_KEY      = `${PLUGIN_NAME}_lastUpdateNotification`;

  /* ==== Sound setup =================================================== */
  const alertSoundUrl = `${location.protocol}//${location.host}/sound/alert.mp3`;
  const alertAudio    = new Audio(alertSoundUrl);
  let   audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked || !PLAY_ALERT_SOUND) return;
    alertAudio.play().then(() => { alertAudio.pause(); audioUnlocked = true; })
                     .catch(() => {});
  }
  window.addEventListener('click',  unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });

  /* ==== Runtime state ================================================= */
  let lastShownTimestamp = null;
  let notFoundToastShown = false;
  let ALERT_ACTIVE       = JSON.parse(localStorage.getItem('ESAlertActive') || 'true');
  let alertIntervalId    = null;
  let lastAzimuths       = [];

  let isAdminLoggedIn = false;
  let isTuneLoggedIn  = false;
  let isAuthenticated = false;
  let azimuthMapWindow = null;
  
  const REGION_KEYS = {
	EU: 'europe',
	NA: 'north_america',
	AU: 'australia'
  };
  
  /* =================================================================== *
   *  Admin / tune mode detection                                        *
   * =================================================================== */
  function checkAdminMode() {
    const txt = document.body.textContent || document.body.innerText;
    isAdminLoggedIn = txt.includes('You are logged in as an administrator.')
                   || txt.includes('You are logged in as an adminstrator.');
    isTuneLoggedIn  = txt.includes('You are logged in and can control the receiver.');
    isAuthenticated = isAdminLoggedIn || isTuneLoggedIn;
  }
  checkAdminMode();

  /* =================================================================== *
   *  Version check (admins only)                                        *
   * =================================================================== */
  function shouldShowUpdateToast() {
    const last = +localStorage.getItem(UPDATE_KEY) || 0;
    if (Date.now() - last > 86_400_000) {
      localStorage.setItem(UPDATE_KEY, Date.now());
      return true;
    }
    return false;
  }
  function compareVersions(a, b) {
    const p = v => v.split(/(\d+|[a-z]+)/i).filter(Boolean)
                    .map(x => (isNaN(x) ? x : +x));
    const A = p(a), B = p(b);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      const x = A[i] ?? 0, y = B[i] ?? 0;
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1;
      if (typeof x === 'string' && typeof y === 'string') return x > y ? 1 : -1;
      return typeof x === 'number' ? -1 : 1;
    }
    return 0;
  }
  function checkPluginVersion() {
    if (!isAuthenticated) return;
    fetch(`${PLUGIN_PATH}${PLUGIN_JS_FILE}`)
      .then(r => r.text())
      .then(t => {
        const m = t.match(/const\s+PLUGIN_VERSION\s*=\s*'([\d.]+[a-z]*)?'/i);
        if (!m) return;
        const remote = m[1] || '0';
        if (compareVersions(PLUGIN_VERSION, remote) === -1 && shouldShowUpdateToast()) {
          sendToast('warning', PLUGIN_NAME,
            `Update available:<br>${PLUGIN_VERSION} → ${remote}`, false, false);
        }
      })
      .catch(e => console.error(`${PLUGIN_NAME}: version check failed`, e));
  }
  setTimeout(checkPluginVersion, 2500);

  /* ==== Helpers ======================================================= */
  function startAlertTimer() {
    if (alertIntervalId === null) {
      fetchOmidData();
      alertIntervalId = setInterval(fetchOmidData, 60_000);
    }
  }
  function stopAlertTimer() {
    if (alertIntervalId !== null) {
      clearInterval(alertIntervalId);
      alertIntervalId = null;
    }
  }
  const fmtTS = rfc => USE_LOCAL_TIME
    ? new Date(rfc).toLocaleString()
    : new Date(rfc).toUTCString();

  /* =================================================================== *
   *  Open map with multiple azimuth lines in draggable window,          *
   *  remember last size & position, show all lines                      *
   * =================================================================== */
function openAzimuthMap() {
  // close any previous
  if (azimuthMapWindow && !azimuthMapWindow.closed) {
    azimuthMapWindow.close();
  }

  // require recent alert
  if (!lastShownTimestamp ||
      (Date.now() - Date.parse(lastShownTimestamp)) / 60000 > LAST_ALERT_MINUTES) {
    sendToast('warning','ES Alert',
      'No map information is currently available for the configured OMID.',
      false,false);
    return;
  }

  const lat = +localStorage.getItem('qthLatitude');
  const lon = +localStorage.getItem('qthLongitude');
  if (isNaN(lat)||isNaN(lon)) {
    sendToast('error','ES Alert','QTH coordinates missing.',false,false);
    return;
  }
  if (!lastAzimuths.length) {
    sendToast('warning','ES Alert','No direction data available yet.',false,false);
    return;
  }

  // restore last position & inner‑size
  const posX = +localStorage.getItem('ESMapPosX')   || 100;
  const posY = +localStorage.getItem('ESMapPosY')   || 100;
  const w    = +localStorage.getItem('ESMapWidth')  || 600;
  const h    = +localStorage.getItem('ESMapHeight') || 600;
  const dirString = lastAzimuths.join(' ');

  const html = `
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>ES Alert Directions: ${dirString}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:18, attribution:'© OpenStreetMap'
  }).addTo(map);

  var p0 = L.latLng(${lat}, ${lon});
  L.marker(p0).addTo(map).bindPopup('QTH');

  function dest(lat,lon,brng,distKm){
    var R=6371, b=brng*Math.PI/180;
    var lat1=lat*Math.PI/180, lon1=lon*Math.PI/180;
    var lat2=Math.asin(Math.sin(lat1)*Math.cos(distKm/R)
       +Math.cos(lat1)*Math.sin(distKm/R)*Math.cos(b));
    var lon2=lon1+Math.atan2(Math.sin(b)*Math.sin(distKm/R)*Math.cos(lat1),
       Math.cos(distKm/R)-Math.sin(lat1)*Math.sin(lat2));
    return [lat2*180/Math.PI,((lon2*180/Math.PI)+540)%360-180];
  }

  var pts=[p0];
  ${JSON.stringify(lastAzimuths)}.forEach(function(az){
    var p1=dest(${lat},${lon},az,2000);
    L.polyline([p0,p1],{color:'red',weight:2})
     .addTo(map).bindTooltip('Azimuth '+az+'°');
    pts.push(p1);
  });

  window.addEventListener('load',()=>{
    map.invalidateSize();
    map.fitBounds(L.latLngBounds(pts),{padding:[20,20]});
  });
</script></body></html>`;

  const blob = new Blob([html],{type:'text/html'});
  const url  = URL.createObjectURL(blob);

  azimuthMapWindow = window.open(
    url,
    '_blank',
    `width=${w},height=${h},left=${posX},top=${posY},resizable,scrollbars`
  );

  // every 500ms store its current innerSize and screen pos
  const poll = setInterval(()=>{
    if (!azimuthMapWindow || azimuthMapWindow.closed) {
      clearInterval(poll);
      URL.revokeObjectURL(url);
    } else {
      try {
        localStorage.setItem('ESMapPosX', azimuthMapWindow.screenX);
        localStorage.setItem('ESMapPosY', azimuthMapWindow.screenY);
        localStorage.setItem('ESMapWidth', azimuthMapWindow.innerWidth);
        localStorage.setItem('ESMapHeight', azimuthMapWindow.innerHeight);
      } catch(e){}
    }
  },500);
}



  /* =================================================================== *
   *  Fetch ES‑alert JSON + toast / sound                                *
   * =================================================================== */
  async function fetchOmidData() {
    const cb = Date.now();
    const url = `${CORS_PROXY_URL}https://www.fmlist.org/esapi/es${OMID}.json?cb=${cb}`;
    try {
      const r = await fetch(url);
      if (r.status === 404) {
        if (!notFoundToastShown) {
          sendToast('warning', 'ES Alert',
            'No information for this OMID.', false, false);
          notFoundToastShown = true;
        }
        return;
      }
      if (!r.ok) {
        sendToast('error', 'ES Alert',
          `HTTP error: ${r.status} ${r.statusText}`, false, false);
        return;
      }
      const { esalert = {} } = await r.json();
      const { esdatetime: ts, directions = [] } = esalert;
      // if JSON returns comma‑separated string, split it
      let dirs = directions;
      if (typeof dirs === 'string') {
        dirs = dirs.split(',').map(x => x.trim()).filter(x => x).map(Number);
      }
      lastAzimuths = dirs;
	  // lastAzimuths = [66, 77, 88];
	  
	  
      if (!ts) {
        sendToast('error', 'ES Alert', 'Invalid alert data.', false, false);
        return;
      }
      const ageMin = (Date.now() - Date.parse(ts)) / 60000;
      if (ageMin <= LAST_ALERT_MINUTES && ts !== lastShownTimestamp) {
        const tStr = fmtTS(ts);
        sendToast(
          'warning important',
          'ES Alert',
          `The following directions might work: ${lastAzimuths.join(' ')}. ` +
          `This Alert has been generated at ${tStr}`,
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

  /* =================================================================== *
   *  Toggle button (admin/tune only + long‑press open map directly)     *
   * =================================================================== */
  (function createToggle(id) {
    const obs = new MutationObserver(() => {
      if (typeof addIconToPluginPanel === 'function') {
        obs.disconnect();
        addIconToPluginPanel(id, 'ES Alert', 'solid', 'bell',
          `Plugin Version: ${PLUGIN_VERSION}`);
        const btnObs = new MutationObserver(() => {
          const $btn = $(`#${id}`);
          if (!$btn.length) return;
          btnObs.disconnect();
          $btn.addClass('hide-phone bg-color-2');
          if (ALERT_ACTIVE) { $btn.addClass('active'); startAlertTimer(); }

          let longPress = false, timer;
          $btn.on('mousedown', () => {
            longPress = false;
            timer = setTimeout(() => {
              longPress = true;
              openAzimuthMap();
            }, 300);
          });
          $btn.on('mouseup', () => {
            clearTimeout(timer);
            if (longPress) return;
            if (!isAuthenticated) {
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
            notFoundToastShown = false;
            if (ALERT_ACTIVE) {
              $btn.addClass('active');
              unlockAudio();
              startAlertTimer();
            } else {
              $btn.removeClass('active');
              stopAlertTimer();
            }
          });
          $btn.on('mouseleave', () => clearTimeout(timer));
        });
        btnObs.observe(document.body, { childList: true, subtree: true });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    $('<style>').prop('type', 'text/css').html(`
      #${id}:hover { color: var(--color-5); filter: brightness(120%); }
      #${id}.active { background-color: var(--color-2) !important;
                      filter: brightness(120%); }
    `).appendTo('head');
  })('ES-ALERT-on-off');

/* =================================================================== *
 *   Injects a toggle switch into the dashboard side-settings          *
 * =================================================================== */
  
function addESStatusToggle() {
  const container = document.querySelector('.panel-full.flex-center.no-bg.m-0');
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';
  wrapper.innerHTML = `
    <div class="switch flex-container flex-phone flex-phone-column flex-phone-center">
      <input type="checkbox" id="es-status-toggle" />
      <label for="es-status-toggle"></label>
      <span class="text-smaller text-uppercase text-bold color-4 p-10">ES Status</span>
    </div>
  `;
  container.after(wrapper);

  const checkbox = document.getElementById('es-status-toggle');
  checkbox.checked = ES_STATUS_ENABLED;
  checkbox.addEventListener('change', () => {
    ES_STATUS_ENABLED = checkbox.checked;
    localStorage.setItem('ES_STATUS_ENABLED', ES_STATUS_ENABLED.toString());
    // show or hide the panel immediately
    const panel = document.getElementById('muf-panel');
    if (panel) panel.style.display = ES_STATUS_ENABLED ? '' : 'none';
  });
}  


/* =================================================================== *
 *   Creates the panel and inserts it into the dashboard               *
 * =================================================================== */

function createPanel() {
  const label = SELECTED_REGION;
  const panelHtml = `
    <div id="muf-panel" class="hide-phone panel panel-small" style="padding:0px 8px;">
      <h3 style="margin:0 0 1px 0; padding:0;">Sporadic E</h3>
      <table style="margin:0; padding:0; border-collapse: collapse;">
        <tbody>
          <tr>
            <td class="text-bold" style="padding:0 2px 0 0; white-space:nowrap; position:relative; top:-5px;">${label}</td>
            <td id="muf-${label.toLowerCase()}" style="padding:0; margin:0; position:relative; top:-5px;">Loading…</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  const container = document.querySelector('.dashboard-panel .panel-100-real .dashboard-panel-plugin-content');
  if (container) {
    container.insertAdjacentHTML('afterend', panelHtml);
  } else {
    document.body.insertAdjacentHTML('beforeend', panelHtml);
  }
}

/* =================================================================== *
 *   Fetches MUF data via the CORS proxy and updates the panel         *
 * =================================================================== */

async function updateMUF() {
  const label = SELECTED_REGION.toLowerCase();
  const cell = document.getElementById(`muf-${label}`);
  if (!cell) return;
  try {
    const url = `${CORS_PROXY_URL}${API_URL}?cb=${Date.now()}`;
    const resp = await fetch(url);
    const data = await resp.json();
    const regionData = data[REGION_KEYS[SELECTED_REGION]];
    if (regionData.max_frequency === 'No data') {
      cell.innerHTML = `<span style="font-size:0.8em; color:red; position:relative; top:-1px;">❌</span>`;
    } else {
      cell.textContent = `${regionData.max_frequency} MHz (${regionData.last_log})`;
    }
  } catch (err) {
    console.warn('MUF request failed:', err);
    cell.textContent = 'Error';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ES_STATUS_ENABLED) return;
  createPanel();
  updateMUF();
  setInterval(updateMUF, 1 * 60 * 1000);
});

})();
