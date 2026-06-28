const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Your live OpenWeatherMap API Key embedded directly
const API_KEY = '3f13318f91a5351ff51af0be9d09f966';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  const blocked = ['/server.js', '/package.json', '/package-lock.json'];
  if (blocked.includes(req.path)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(path.join(__dirname), { dotfiles: 'ignore' }));

async function proxyFetch(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || `OpenWeather request failed with ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

app.get('/api/geocode', async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ message: 'Missing city query parameter.' });

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const data = await proxyFetch(url);
    return res.json(data);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

app.get('/api/weather', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const unit = req.query.unit === 'imperial' ? 'imperial' : 'metric';

  if (!lat || !lon) return res.status(400).json({ message: 'Missing lat or lon query parameters.' });

  try {
    // Call the two completely free endpoints in parallel
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${unit}&appid=${API_KEY}`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${unit}&appid=${API_KEY}`;

    const [currentData, forecastData] = await Promise.all([
      proxyFetch(currentUrl),
      proxyFetch(forecastUrl)
    ]);

    // Group the 3-hour chunks into separate days
    const dailyMap = {};
    if (forecastData && forecastData.list) {
      forecastData.list.forEach(item => {
        const dateStr = new Date(item.dt * 1000).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) dailyMap[dateStr] = [];
        dailyMap[dateStr].push(item);
      });
    }

    // Process daily summaries to match the OneCall array structure
    const daily = Object.keys(dailyMap).map(dateStr => {
      const items = dailyMap[dateStr];
      // Pick a mid-day data entry to represent the overall daytime weather look
      const midDayItem = items.find(item => item.dt_txt.includes('12:00:00')) || items[Math.floor(items.length / 2)];
      
      let minTemp = Infinity;
      let maxTemp = -Infinity;
      let totalHumidity = 0;
      let totalWind = 0;
      let maxPop = 0;

      items.forEach(item => {
        if (item.main.temp_min < minTemp) minTemp = item.main.temp_min;
        if (item.main.temp_max > maxTemp) maxTemp = item.main.temp_max;
        totalHumidity += item.main.humidity;
        totalWind += item.wind.speed;
        if (item.pop > maxPop) maxPop = item.pop;
      });

      return {
        dt: midDayItem.dt,
        temp: {
          day: midDayItem.main.temp,
          min: minTemp,
          max: maxTemp
        },
        humidity: Math.round(totalHumidity / items.length),
        wind_speed: totalWind / items.length,
        pop: maxPop,
        weather: midDayItem.weather,
        rain: midDayItem.rain?.['3h'] || undefined,
        snow: midDayItem.snow?.['3h'] || undefined
      };
    });

    // Restructure everything cleanly into the exact model weather.js expects
    const translatedData = {
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      current: {
        dt: currentData.dt,
        temp: currentData.main.temp,
        feels_like: currentData.main.feels_like,
        pressure: currentData.main.pressure,
        humidity: currentData.main.humidity,
        uvi: 0, // Fallback placeholder since free tier lacks native UV index
        visibility: currentData.visibility,
        wind_speed: currentData.wind.speed,
        weather: currentData.weather
      },
      daily: daily
    };

    return res.json(translatedData);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});