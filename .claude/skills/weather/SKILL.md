---
name: weather
description: Obtiene el clima local (actual y pronóstico) para una ciudad o coordenadas usando APIs gratuitas sin API-key (Open-Meteo). Úsala cuando el usuario pida el clima, temperatura, pronóstico, o "¿cómo está el tiempo?".
---

# Weather

Obtiene información del clima usando **Open-Meteo** (gratis, sin API-key, sin registro).

## Cómo usarla

1. **Determinar ubicación**: Si el usuario da una ciudad, geocodifícala. Si da coordenadas (lat/lon), úsalas directamente. Si no especifica, pregunta o usa la ciudad por defecto que el usuario indique.

2. **Geocodificar** (ciudad → lat/lon) con la API de geocoding de Open-Meteo:
   ```
   https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD>&count=1&language=es&format=json
   ```
   Extrae `latitude`, `longitude`, `name`, `country` del primer resultado (`results[0]`).

3. **Obtener el clima** con lat/lon:
   ```
   https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3
   ```

4. **Ejecutar la petición**. Prefiere el script incluido (maneja geocoding + clima + traducción de códigos en un paso):
   ```
   node .claude/skills/weather/weather.js "<ciudad>"
   ```
   Si Node no está disponible, usa la herramienta WebFetch con las URLs de arriba.

## Traducción de weather_code (WMO)

0: Despejado · 1-3: Parcialmente nublado · 45,48: Niebla · 51-57: Llovizna · 61-67: Lluvia · 71-77: Nieve · 80-82: Chubascos · 95-99: Tormenta

## Presentar resultados

Muestra: ubicación, temperatura actual (y sensación térmica), humedad, viento, descripción del cielo, y pronóstico de 3 días (máx/mín + prob. lluvia). Sé conciso.
