# Weather Report

This project now includes a small Express backend proxy so your OpenWeatherMap API key is stored server-side rather than in browser JavaScript.

## Setup

1. Install dependencies:
   ```powershell
   npm install
   ```

2. Create a `.env` file in the project root with:
   ```env
   OPENWEATHER_API_KEY=your_openweathermap_api_key_here
   ```

3. Start the server:
   ```powershell
   npm start
   ```

4. Open `http://localhost:3000/weather.html` in your browser.

> If you use Live Server or another front-end-only host at `127.0.0.1:5500`, the frontend now forwards API requests to `http://localhost:3000/api`, and the backend includes CORS support for local testing.

## What changed

- `server.js` now proxies OpenWeatherMap requests through the backend.
- The frontend no longer stores or sends an API key from the browser.
- The API key is now only read from `process.env.OPENWEATHER_API_KEY`.
- Client-side Unicode/encoding issues were cleaned up.

## Notes

- GitHub Pages cannot host this backend. You need a server that can run Node.js.
- Keep `.env` out of source control; it is ignored by `.gitignore`.
