(() => {
  ////////////////////////////////////////////////////////
  ///                                                  ///
  ///  ES ALERT SCRIPT FOR FM-DX WEBSERVER (V1.5a)     ///
  ///                                                  ///
  ///  by Highpoint           last update 06.05.2025   ///
  ///                                                  ///
  ///  https://github.com/Highpoint2000/ES-Alert       ///
  ///                                                  ///
  ////////////////////////////////////////////////////////

  /* ==== ES ALERT & MUF Info Options ================================================= */
  const OMID               		= '';		// Enter the valid FMLIST OMID here, e.g. '1234'
  const SELECTED_REGION    		= 'EU';		// 'EU', 'NA', or 'AU'
  const LAST_ALERT_MINUTES 		= 15;		// Minutes to look back when page loads (default is 15)
  const PLAY_ALERT_SOUND   		= true;		// true = play sound on new alert
    
  /* ==== ES Ticker Options ================================================= */
  const LAST_TICKER_MINUTES 	= 5;		// Minutes to show last ticker logs (default is 5)
  const NUMBER_TICKER_LOGS 		= 5;		// Number of ticker logs until repetition (5 is default, 1 is only the latest) 
  const TICKER_ROTATE_SECONDS 	= 5;		// Rotate every X seconds
  const TICKER_REGION 			= 'EU';		// 'EU', 'NA', or 'AU' or ITU Code of Country (D, SUI, GRC ...)

 /* ==== Global Options ================================================= */
  const USE_LOCAL_TIME     		= true; 	// true = display in local time, false = UTC/GMT

  ////////////////////////////////////////////////////////

  // Region → rxin mapping
  const REGION_RXIN = {
   EU: 'Eur',
   NA: 'Ame',
   AU: 'AUT'
  };

  const rxin = REGION_RXIN[TICKER_REGION] || TICKER_REGION.toUpperCase();
  const sec = LAST_TICKER_MINUTES * 60;

  /* ==== Global variables  ================================================= */
  const PLUGIN_VERSION     = '1.5a';
  const PLUGIN_PATH        = 'https://raw.githubusercontent.com/highpoint2000/ES-Alert/';
  const API_URL            = 'https://fmdx.org/includes/tools/get_muf.php';
  const SOURCE_URL 		   = `https://www.fmlist.org/fm_logmap.php?&hours=${sec}&omid=all&band=Es&rxin=${rxin}&target=ALL`;
  const CORS_PROXY_URL     = 'https://cors-proxy.de:13128/';
  const PLUGIN_JS_FILE     = 'main/ES-Alert/es-alert.js';
  const PLUGIN_NAME        = 'ES-Alert';
  const UPDATE_KEY         = `${PLUGIN_NAME}_lastUpdateNotification`;
  const ES_STATUS_ENABLED  = true;
  
  /* ==== Inject link CSS ==================================== */
  const css = `
    .es-frequency-link { text-decoration: none; }
    .es-frequency-link:hover { text-decoration: underline; }
    #esAlertTickerHeading { text-decoration: none; cursor: pointer; }
    #esAlertTickerHeading:hover { text-decoration: underline; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  
  /* ==== Sound setup ======================================================= */
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

  /* ==== Runtime state ===================================================== */
  let lastShownTimestamp = null;
  let notFoundToastShown = false;
  let ALERT_ACTIVE       = JSON.parse(localStorage.getItem('ESAlertActive') || 'true');
  let alertIntervalId    = null;
  let lastAzimuths       = [];

  let isAdminLoggedIn    = false;
  let isTuneLoggedIn     = false;
  let isAuthenticated    = false;
  let azimuthMapWindow   = null;
  const domain = window.location.host; 

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
    const domain = window.location.host;
	const url = `${CORS_PROXY_URL}https://www.fmlist.org/esapi/es${OMID}.json?cb=${cb}&domain=${domain}`;
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
   *   WebSocket frequency sender (ephemeral connection)                *
   * =================================================================== */
  const currentURL = new URL(window.location.href);
  const protocol = currentURL.protocol === 'https:' ? 'wss:' : 'ws:';
  const WebsocketPORT = currentURL.port || (currentURL.protocol === 'https:' ? '443' : '80');
  const WEBSOCKET_URL = `${protocol}//${currentURL.hostname}:${WebsocketPORT}${currentURL.pathname.replace(/setup/g,'')}text`;

  function sendFrequency(freq, event) {
    event.preventDefault();
    const dataToSend = `T${(parseFloat(freq)*1000).toFixed(0)}`;
    const ws = new WebSocket(WEBSOCKET_URL);
    ws.addEventListener('open', () => {
      ws.send(dataToSend);
      console.log('Frequency sent:', dataToSend);
      ws.close();
    });
    ws.addEventListener('error', err => console.error('WebSocket error:', err));
  }
  window.sendFrequency = sendFrequency;

  /* ====================== TICKER MODULE ============================== */

    const TICKER_CONTAINER_SELECTOR = '.wrapper-outer.main-content';
	const ROTATE_MS = TICKER_ROTATE_SECONDS * 1000;
    const REFRESH_MS = 60000;
	
    let tickerEntries = [];
    let tickerIndex = 0;
    let nextEntries = [];
    const container = document.querySelector(TICKER_CONTAINER_SELECTOR);
    let tickerEl;

    if (container) {
      const heading = document.createElement('h3');
      heading.id = 'esAlertTickerHeading';
      heading.setAttribute('style', 'margin: 0; padding: 0; text-align: right;');
      heading.textContent = `ES Ticker ${TICKER_REGION} (Last ${LAST_TICKER_MINUTES} Minutes)`;
      // Make heading clickable to open full logmap
      heading.style.cursor = 'pointer';
      heading.addEventListener('click', () => {
      window.open(SOURCE_URL, '_blank');
      });
      tickerEl = document.createElement('div');
      tickerEl.id = 'esAlertTicker';
      Object.assign(tickerEl.style, {
		minHeight: '6ch',
        fontFamily: 'sans-serif', fontSize: '1rem', color: 'white', background: 'none',
        border: 'none', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
        padding: '0.1em', marginBottom: '0.1em'
      });
      tickerEl.textContent = 'Loading logs…';
      container.prepend(tickerEl);
      container.prepend(heading);
      const mobileStyle = document.createElement('style');
      mobileStyle.textContent = `@media(max-width:768px){#esAlertTicker,#esAlertTickerHeading{display:none!important;}}`;
      document.head.appendChild(mobileStyle);
    }
	
	
    async function loadTickerFeed() {
      try {
        const res = await fetch(CORS_PROXY_URL + SOURCE_URL + `&cb=${Date.now()}&domain=${domain}`);
        const textBuf = await res.arrayBuffer();
        const text = new TextDecoder('windows-1252').decode(textBuf);
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const rows = Array.from(doc.querySelectorAll('tr[valign="top"]')).reverse();
        nextEntries = rows.map(row => {
          const tds = row.querySelectorAll('td');
          const timeRaw = tds[1]?.textContent.trim().padStart(4,'0') || '0000';
          const hours = +timeRaw.slice(0,2), mins = +timeRaw.slice(2);
          const utcDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), hours, mins));
          const ageMin = Math.floor((Date.now() - utcDate) / 60000);
          if (ageMin > LAST_TICKER_MINUTES) return null;
          const timeDisplay = USE_LOCAL_TIME
            ? utcDate.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
            : `${timeRaw.slice(0,2)}:${timeRaw.slice(2)} UTC`;
          const freq = tds[3]?.textContent.trim();
          const country = tds[4]?.textContent.trim();
          const senderRaw = tds[5]?.textContent.trim();
          const rxInfoRaw = tds[8]?.textContent.trim() || '';
          if (!freq || !senderRaw || !rxInfoRaw) return null;
          const senderClean = senderRaw.replace(/\s*\([^()]*\)/g,'').trim();
          const ageText = ageMin===0 ? '(just now)' : `(${ageMin} min ago)`;
          return { freq, senderClean, country, rxInfoRaw, timeDisplay, ageText };
        }).filter(Boolean).slice(0, NUMBER_TICKER_LOGS);
      } catch(err) { console.error('Ticker load error:', err); nextEntries = []; }
    }

    function rotateTicker() {
      if (!tickerEl) return;
      if (!nextEntries.length) {
        tickerEl.textContent = 'No log entries available.';
        return;
      }
      const entry = nextEntries[tickerIndex % nextEntries.length];
      tickerEl.innerHTML = '';
      // Create frequency link span
      const freqSpan = document.createElement('span');
      freqSpan.textContent = `${entry.freq} MHz`;
      freqSpan.classList.add('es-frequency-link');
      freqSpan.title = 'Tune to frequency';
      freqSpan.style.cursor = 'pointer';
      freqSpan.addEventListener('click', e => sendFrequency(entry.freq, e));
      tickerEl.appendChild(freqSpan);
      // Append rest text
      tickerEl.appendChild(document.createTextNode(` | ${entry.senderClean} [${entry.country}] `));
      const small = document.createElement('span');
      small.style.cssText = 'font-size:0.8rem;color:grey;';
      small.textContent = `${entry.rxInfoRaw.replace(/[()]/g,m=>m==='('?'[':']')} | ${entry.timeDisplay} ${entry.ageText}`;      
      tickerEl.appendChild(document.createElement('br')); // Add line break
      tickerEl.appendChild(small);
      tickerIndex++;
    }

  
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
            <td class="text-bold"
                style="padding:0 2px 0 0; white-space:nowrap; position:relative; top:-5px;">
              ${label}
            </td>
            <td id="muf-${label.toLowerCase()}"
                style="padding:0 0 0 3px; margin:0; position:relative; top:-5px; font-size:0.8em;"
                title="Last updated: –">
              Loading…
            </td>
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
    // include your own host:port
    const url = `${CORS_PROXY_URL}${API_URL}?cb=${Date.now()}&domain=${domain}`;

    const resp = await fetch(url);
    const data = await resp.json();
    const regionData = data[REGION_KEYS[SELECTED_REGION]];
	
	regionData.max = '104';
	
    // Update MUF display
    if (regionData.max_frequency === 'No data') {
      cell.innerHTML = `<span style="font-size:0.8em; color:red; position:relative; top:-1px;">❌</span>`;
    } else {
      cell.textContent = `up to ${regionData.max_frequency} MHz`;
    }

    // Set tooltip to show last_log time
    const lastLog = regionData.last_log;
    if (lastLog && lastLog !== 'No data') {
      cell.setAttribute('title', `Last updated: ${lastLog}`);
    } else {
      cell.removeAttribute('title');
    }
  } catch (err) {
    console.warn('MUF request failed:', err);
    cell.textContent = 'Error';
    cell.removeAttribute('title');
  }
}

  /* =================================================================== *
   *   Initializes Dashboard Extensions for Sporadic E MUF Panel         *
   * =================================================================== */
  document.addEventListener('DOMContentLoaded', () => {  
	  
  // 1) Find existing “Manual decimals” form-group
  const manualGroup = document
    .getElementById('extended-frequency-range')
    .closest('.form-group');

  // 2) Create a new form-group for the “Sporadic E” toggle
  const sporadicGroup = document.createElement('div');
  sporadicGroup.className = 'form-group';
  sporadicGroup.innerHTML = `
    <div class="switch flex-container flex-phone flex-phone-column flex-phone-center">
      <input
        type="checkbox"
        tabindex="0"
        id="toggle-sporadic-e"
        aria-label="Sporadic E"
      />
      <label for="toggle-sporadic-e"></label>
      <span class="text-smaller text-uppercase text-bold color-4 p-10">
        HIDE SPORADIC E
      </span>
    </div>
  `;
  manualGroup.parentNode.insertBefore(sporadicGroup, manualGroup);

  // 3) Create the MUF panel
  createPanel();

  // 4) Grab references
  const panel       = document.getElementById('muf-panel');
  const toggle      = document.getElementById('toggle-sporadic-e');
  let mufInterval;  // will hold our interval ID

  // 5) Load last saved state (default: unchecked = shown)
  //    stored value 'true' now means “hide”
  const hideOnChecked = localStorage.getItem('sporadicEEnabled') === 'true';
  toggle.checked = hideOnChecked;
  panel.style.display = hideOnChecked ? 'none' : '';

  // 6) Helper to start polling
  function startPolling() {
    updateMUF();
    mufInterval = setInterval(updateMUF, 60 * 1000);
  }

  // 7) Helper to stop polling
  function stopPolling() {
    clearInterval(mufInterval);
  }

  // 8) Begin polling only if panel is visible
  if (!hideOnChecked) startPolling();

  // 9) On toggle change: hide/show panel and start/stop polling
  toggle.addEventListener('change', () => {
    const checked = toggle.checked;
    // checked = hide panel
    panel.style.display = checked ? 'none' : '';
    localStorage.setItem('sporadicEEnabled', checked);

    if (checked) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  // 10) Add ES Ticker toggle
  const tickerToggleWrapper = document.createElement('div');
  tickerToggleWrapper.className = 'form-group';
  tickerToggleWrapper.innerHTML = `
    <div class="switch flex-container flex-phone flex-phone-column flex-phone-center">
      <input type="checkbox" id="toggle-es-ticker" />
      <label for="toggle-es-ticker"></label>
      <span class="text-smaller text-uppercase text-bold color-4 p-10">
        HIDE ES TICKER
      </span>
    </div>
  `;
  sporadicGroup.after(tickerToggleWrapper);

  // 11) Load and apply ticker state
const tickerToggle = document.getElementById('toggle-es-ticker');
const tickerHideOnChecked = localStorage.getItem('esTickerEnabled') === 'true';
tickerToggle.checked = tickerHideOnChecked;

const headingEl = document.getElementById('esAlertTickerHeading');
const tickerEl = document.getElementById('esAlertTicker');

if (tickerHideOnChecked) {
  if (headingEl) headingEl.style.display = 'none';
  if (tickerEl) tickerEl.style.display = 'none';
} else {
  (async function initTicker() {
    await loadTickerFeed();
    setInterval(loadTickerFeed, REFRESH_MS);
    setInterval(rotateTicker, ROTATE_MS);
  })();
}

tickerToggle.addEventListener('change', () => {
  const hide = tickerToggle.checked;
  localStorage.setItem('esTickerEnabled', hide);

  if (headingEl) headingEl.style.display = hide ? 'none' : '';
  if (tickerEl) tickerEl.style.display = hide ? 'none' : '';

  // Wenn der Ticker angezeigt werden soll, lade ihn neu und starte die Intervalle
  if (!hide) {
    (async function initTicker() {
      await loadTickerFeed();
      setInterval(loadTickerFeed, REFRESH_MS);
      setInterval(rotateTicker, ROTATE_MS);
    })();
  }
});
  
});

})();
