/* WEATHER APP */
const API_BASE = (() => {
  const fallback = 'http://localhost:3000/api';
  const origin = window.location.origin;
  const protocol = window.location.protocol;

  if (protocol === 'file:' || origin === 'null') {
    return fallback;
  }

  if (origin.includes(':5500') || origin.includes(':5501')) {
    return fallback;
  }

  return '/api';
})();
const UNIT_KEY = 'owm_unit';
let unit = localStorage.getItem(UNIT_KEY) || 'metric';
let lastData = null;

/* DOM REFS */
const $ = id => document.getElementById(id);
const cityInput      = $('cityInput');
const searchBtn      = $('searchBtn');
const locationBtn    = $('locationBtn');
const statusMsg      = $('statusMessage');
const summarySection = $('summarySection');
const forecastSection= $('forecastSection');
const skeletonEl     = $('loadingSkeleton');
const locationName   = $('locationName');
const summaryText    = $('summaryText');
const currentTemp    = $('currentTemp');
const todayHigh      = $('todayHigh');
const chanceRain     = $('chanceRain');
const weatherAlerts  = $('weatherAlerts');
const searchHistory  = $('searchHistory');
const predictionBanner= $('predictionBanner');
const unitToggle     = $('unitToggle');
const currentStrip   = $('currentStrip');

const unitLabel = () => unit === 'metric' ? '°C' : '°F';
const windLabel = () => unit === 'metric' ? 'm/s' : 'mph';

function showStatus(msg, type = '') {
  statusMsg.className = 'notice' + (type ? ' ' + type : '');
  if (type === 'loading') {
    statusMsg.innerHTML = `<span class="spinner"></span>${msg}`;
  } else {
    statusMsg.textContent = msg;
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    throw new Error(data?.message || `Server error (${res.status}). Try again shortly.`);
  }
  return data;
}

async function geocodeCity(city) {
  if (!city.trim()) throw new Error('Enter a city name.');
  const data = await fetchJSON(`${API_BASE}/geocode?city=${encodeURIComponent(city)}`);
  if (!data?.length) throw new Error(`"${city}" not found. Try another city.`);
  return { lat: data[0].lat, lon: data[0].lon, name: `${data[0].name}, ${data[0].country}` };
}

async function fetchWeather(lat, lon) {
  const u = unit === 'metric' ? 'metric' : 'imperial';
  return fetchJSON(`${API_BASE}/weather?lat=${lat}&lon=${lon}&unit=${u}`);
}

const fmtDay  = ts => new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(ts * 1000));
const fmtDate = ts => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(ts * 1000));
const capitalize = s => s.replace(/\b\w/g, c => c.toUpperCase());

function formatUV(uvi) {
  if (uvi <= 2) return 'Low';
  if (uvi <= 5) return 'Moderate';
  if (uvi <= 7) return 'High';
  if (uvi <= 10) return 'Very High';
  return 'Extreme';
}

function showSkeleton() {
  skeletonEl.hidden = false;
  summarySection.hidden = true;
  forecastSection.hidden = true;
  if (predictionBanner) predictionBanner.hidden = true;
}

function hideSkeleton() {
  skeletonEl.hidden = true;
}

function buildForecastCard(day) {
  const icon  = day.weather[0]?.icon || '01d';
  const desc  = day.weather[0]?.description || 'Clear';
  const pop   = Math.round((day.pop || 0) * 100);
  const rain  = day.rain ? `${day.rain.toFixed(1)} mm` : day.snow ? `${day.snow.toFixed(1)} mm snow` : '—';

  const tempDay = Math.round(day.temp.day);
  const tempMax = Math.round(day.temp.max);
  const tempMin = Math.round(day.temp.min);
  const wind    = Math.round(day.wind_speed);

  return `
  <article class="day-card">
    <div class="top-row">
      <div>
        <strong>${fmtDay(day.dt)}</strong>
        <div class="date">${fmtDate(day.dt)}</div>
      </div>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}" loading="lazy"/>
    </div>
    <div class="temp">${tempDay}${unitLabel()}</div>
    <div class="condition">${capitalize(desc)}</div>
    <div class="details">
      <div class="detail-row">
        <span class="label">High / Low</span>
        <span class="value">${tempMax}° / ${tempMin}°</span>
      </div>
      <div class="detail-row">
        <span class="label">Humidity</span>
        <span class="value">${day.humidity}%</span>
      </div>
      <div class="detail-row">
        <span class="label">Wind</span>
        <span class="value">${wind} ${windLabel()}</span>
      </div>
      <div class="detail-row">
        <span class="label">Rain</span>
        <span class="value">${rain}</span>
      </div>
      <div class="rain-bar-wrap">
        <span class="label" style="white-space:nowrap;font-size:0.8rem">${pop}%</span>
        <div class="rain-bar"><div class="rain-bar-fill" style="width:${pop}%"></div></div>
      </div>
    </div>
  </article>`;
}

function buildPrediction(daily, current) {
  const today    = daily[0];
  const tomorrow = daily[1] || today;
  const pop      = Math.round((today.pop || 0) * 100);
  const tomorrowPop = Math.round((tomorrow.pop || 0) * 100);
  const tempToday = Math.round(today.temp.max);
  const tempTomorrow = Math.round(tomorrow.temp.max);
  const windNow   = Math.round(current.wind_speed);
  const uvNow     = Math.round(current.uvi || 0);
  const tips = [];

  if (pop >= 60) tips.push(`High chance of rain today (${pop}%) - bring an umbrella.`);
  else if (tomorrowPop >= 60) tips.push(`Rain likely tomorrow (${tomorrowPop}%) - plan ahead.`);

  if (uvNow >= 8) tips.push(`UV index is ${uvNow} (${formatUV(uvNow)}) - wear sunscreen and limit midday sun.`);
  else if (uvNow >= 6) tips.push(`UV index is moderate-high (${uvNow}) - sunscreen recommended.`);

  if (windNow > 10 && unit === 'metric') tips.push(`Strong winds today (${windNow} m/s) - secure loose items outdoors.`);
  if (windNow > 22 && unit === 'imperial') tips.push(`Strong winds today (${windNow} mph) - take care outdoors.`);

  const diff = tempTomorrow - tempToday;
  if (diff >= 5) tips.push(`Tomorrow will be noticeably warmer (+${diff}°) - good day to plan outdoor activities.`);
  else if (diff <= -5) tips.push(`Temperature drops ${Math.abs(diff)}° tomorrow - dress in layers.`);

  const cond = (current.weather[0]?.main || '').toLowerCase();
  if (cond.includes('thunder')) tips.push('Thunderstorms active - avoid open areas and stay indoors if possible.');
  if (cond.includes('snow'))    tips.push('Snowfall in the area - drive carefully and allow extra travel time.');
  if (cond.includes('fog') || cond.includes('mist')) tips.push('Low visibility conditions - drive slowly and use fog lights.');

  if (tips.length === 0) tips.push(`Conditions look good today. Enjoy the ${capitalize(current.weather[0]?.description || 'weather')}!`);
  return tips;
}

function renderWeather(label, data, coords = {}) {
  lastData = { label, data, ...coords };
  const today   = data.current;
  const daily   = data.daily.slice(0, 7);
  const rain    = Math.round((daily[0].pop || 0) * 100);
  const cond    = today.weather[0]?.description || 'Clear skies';
  const icon    = today.weather[0]?.icon || '01d';
  const tempNow = Math.round(today.temp);
  const high    = Math.round(daily[0].temp.max);
  const low     = Math.round(daily[0].temp.min);

  locationName.textContent = label;
  summaryText.textContent  = `${capitalize(cond)} · Feels like ${Math.round(today.feels_like)}${unitLabel()}`;
  currentTemp.textContent  = `${tempNow}${unitLabel()}`;
  todayHigh.textContent    = `${high}° / ${low}°`;
  chanceRain.textContent   = `${rain}%`;

  currentStrip.innerHTML = `
    <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${cond}" />
    <div class="cond-text">
      <strong>${capitalize(cond)}</strong>
      <span>Feels like ${Math.round(today.feels_like)}${unitLabel()}</span>
    </div>
    <div class="extra-stats">
      <div class="stat-pill">
        <span class="stat-val">${today.humidity}%</span>
        <span class="stat-lbl">Humidity</span>
      </div>
      <div class="stat-pill">
        <span class="stat-val">${Math.round(today.wind_speed)} ${windLabel()}</span>
        <span class="stat-lbl">Wind</span>
      </div>
      <div class="stat-pill">
        <span class="stat-val">${today.visibility ? (today.visibility / 1000).toFixed(1) + ' km' : '—'}</span>
        <span class="stat-lbl">Visibility</span>
      </div>
      <div class="stat-pill">
        <span class="stat-val">${formatUV(today.uvi || 0)}</span>
        <span class="stat-lbl">UV Index</span>
      </div>
      <div class="stat-pill">
        <span class="stat-val">${today.pressure} hPa</span>
        <span class="stat-lbl">Pressure</span>
      </div>
    </div>
  `;

  if (data.alerts?.length) {
    weatherAlerts.hidden = false;
    weatherAlerts.textContent = data.alerts.map(a => `${a.event}: ${a.description}`).join('\n\n');
  } else {
    weatherAlerts.hidden = true;
  }

  forecastSection.innerHTML = daily.map(buildForecastCard).join('');

  if (predictionBanner) {
    const tips = buildPrediction(daily, today);
    predictionBanner.innerHTML = tips.map(t => `
      <div class="prediction-banner">
        <div class="pred-body">${t}</div>
      </div>`).join('');
    predictionBanner.hidden = false;
  }

  summarySection.hidden  = false;
  forecastSection.hidden = false;
}

function getHistory() {
  return JSON.parse(localStorage.getItem('owm_search_history') || '[]');
}

function saveSearch(city) {
  const list = [city, ...getHistory().filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 6);
  localStorage.setItem('owm_search_history', JSON.stringify(list));
  renderHistory();
}

function renderHistory() {
  const list = getHistory();
  if (!list.length) {
    searchHistory.innerHTML = '';
    return;
  }
  searchHistory.innerHTML = `
    <h3>Recent searches</h3>
    <div class="history-list">
      ${list.map(c => `<button class="history-item" data-city="${c}">${c}</button>`).join('')}
    </div>`;
  searchHistory.querySelectorAll('.history-item').forEach(btn => {
    btn.addEventListener('click', () => {
      cityInput.value = btn.dataset.city;
      loadCity();
    });
  });
}

async function loadCity() {
  try {
    showSkeleton();
    showStatus('Searching...', 'loading');
    const { lat, lon, name } = await geocodeCity(cityInput.value.trim());
    const weather = await fetchWeather(lat, lon);
    hideSkeleton();
    renderWeather(name, weather, { lat, lon });
    saveSearch(name);
    showStatus(`Showing weather for ${name}.`, 'success');
  } catch (e) {
    hideSkeleton();
    showStatus(e.message, 'error');
  }
}

async function loadLocation(auto = false) {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by your browser.', 'error');
    return;
  }
  showSkeleton();
  showStatus('Fetching your location...', 'loading');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const weather = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        hideSkeleton();
        renderWeather('Current Location', weather, { lat: pos.coords.latitude, lon: pos.coords.longitude });
        showStatus('Showing weather for your current location.', 'success');
      } catch (e) {
        hideSkeleton();
        showStatus(e.message, 'error');
      }
    },
    () => {
      hideSkeleton();
      if (auto) showStatus('Allow location access or search a city.', 'error');
      else showStatus('Location permission denied. Search a city instead.', 'error');
    },
    { timeout: 10000 }
  );
}

function setupUnitToggle() {
  if (!unitToggle) return;
  unitToggle.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.unit === unit) btn.classList.add('active');
    btn.addEventListener('click', async () => {
      if (btn.dataset.unit === unit) return;
      unit = btn.dataset.unit;
      localStorage.setItem(UNIT_KEY, unit);
      unitToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
      if (lastData) {
        try {
          showSkeleton();
          showStatus('Switching units...', 'loading');
          const { label, lat, lon } = lastData;
          if (!lat || !lon) throw new Error('Unable to switch units for this location. Please search again.');
          const fresh = await fetchWeather(lat, lon);
          hideSkeleton();
          renderWeather(label, fresh, { lat, lon });
          showStatus(`Switched to ${unit === 'metric' ? 'Celsius' : 'Fahrenheit'}.`, 'success');
        } catch (e) {
          hideSkeleton();
          showStatus(e.message, 'error');
        }
      }
    });
  });
}

function bindEvents() {
  searchBtn.addEventListener('click', loadCity);
  locationBtn.addEventListener('click', () => loadLocation(false));
  cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadCity(); });
}

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  setupUnitToggle();
  renderHistory();
  loadLocation(true);
});
