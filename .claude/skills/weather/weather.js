#!/usr/bin/env node
// Clima local vía Open-Meteo (sin API-key). Uso: node weather.js "Ciudad"
// o: node weather.js --lat 40.4 --lon -3.7

const WMO = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna', 55: 'Llovizna intensa',
  56: 'Llovizna helada', 57: 'Llovizna helada intensa',
  61: 'Lluvia ligera', 63: 'Lluvia', 65: 'Lluvia intensa',
  66: 'Lluvia helada', 67: 'Lluvia helada intensa',
  71: 'Nieve ligera', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granizo de nieve',
  80: 'Chubascos ligeros', 81: 'Chubascos', 82: 'Chubascos violentos',
  85: 'Chubascos de nieve', 86: 'Chubascos de nieve intensos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte',
};
const desc = (c) => WMO[c] ?? `Código ${c}`;

async function j(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.json();
}

async function geocode(name) {
  const u = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=es&format=json`;
  const d = await j(u);
  if (!d.results || !d.results.length) throw new Error(`No se encontró la ciudad: ${name}`);
  const g = d.results[0];
  return { lat: g.latitude, lon: g.longitude, label: `${g.name}, ${g.country}` };
}

async function main() {
  const args = process.argv.slice(2);
  let lat, lon, label;

  const li = args.indexOf('--lat'), oi = args.indexOf('--lon');
  if (li !== -1 && oi !== -1) {
    lat = parseFloat(args[li + 1]); lon = parseFloat(args[oi + 1]);
    label = `${lat}, ${lon}`;
  } else {
    const city = args.filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!city) { console.error('Uso: node weather.js "Ciudad"  |  --lat <n> --lon <n>'); process.exit(1); }
    ({ lat, lon, label } = await geocode(city));
  }

  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
    + `&timezone=auto&forecast_days=3`;
  const d = await j(u);

  const c = d.current, uc = d.current_units;
  console.log(`\n📍 ${label}`);
  console.log(`   ${desc(c.weather_code)}`);
  console.log(`   🌡  ${c.temperature_2m}${uc.temperature_2m} (sensación ${c.apparent_temperature}${uc.temperature_2m})`);
  console.log(`   💧 Humedad ${c.relative_humidity_2m}${uc.relative_humidity_2m}   💨 Viento ${c.wind_speed_10m} ${uc.wind_speed_10m}`);

  console.log('\n   Pronóstico:');
  const dl = d.daily;
  for (let i = 0; i < dl.time.length; i++) {
    console.log(`   ${dl.time[i]}  ${desc(dl.weather_code[i])}  `
      + `${dl.temperature_2m_min[i]}–${dl.temperature_2m_max[i]}°C  `
      + `lluvia ${dl.precipitation_probability_max[i]}%`);
  }
  console.log('');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
