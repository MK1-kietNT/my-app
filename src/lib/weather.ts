export interface WeatherLocation {
  name: string;
  admin?: string;
  country?: string;
  latitude: number;
  longitude: number;
  source: 'gps' | 'search' | 'default';
}

export interface HourlyForecastItem {
  time: string; // ISO string
  hourLabel: string; // e.g. "14:00"
  temp: number; // weighted ensemble + bias corrected
  tempRaw: number;
  spread: number; // max - min across models
  precipProb: number;
  weatherCode: number;
  humidity: number;
}

export interface DailyForecastItem {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Hôm nay", "T6 27/11"
  tempMin: number;
  tempMax: number;
  precipProbMax: number;
  weatherCode: number;
  uvMax: number;
}

export interface ModelReading {
  id: 'ecmwf' | 'icon' | 'gfs' | 'best_match';
  label: string;
  weight: number;
  currentTemp: number | null;
}

export interface WeatherData {
  location: WeatherLocation;
  updatedAt: number;
  current: {
    temp: number;
    apparentTemp: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    precip: number;
    uvIndex: number;
    isDay: boolean;
  };
  confidence: {
    percent: number;
    spreadC: number;
    label: string;
  };
  models: ModelReading[];
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
}

const WEATHER_CACHE_KEY = 'wealthflow_weather_cache_v1';
const LOCATION_CACHE_KEY = 'wealthflow_weather_loc_v1';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const DEFAULT_LOCATION: WeatherLocation = {
  name: 'TP. Hồ Chí Minh',
  country: 'Việt Nam',
  latitude: 10.7769,
  longitude: 106.7009,
  source: 'default',
};

export function getSavedLocation(): WeatherLocation {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeatherLocation;
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LOCATION;
}

export function saveLocation(loc: WeatherLocation) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(loc));
  } catch {
    // ignore
  }
}

export function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as WeatherData;
    if (Date.now() - data.updatedAt < CACHE_TTL_MS) {
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveWeatherCache(data: WeatherData) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function describeWeatherCode(code: number): {
  text: string;
  emoji: string;
  tone: 'sun' | 'cloud' | 'rain' | 'storm';
} {
  if (code === 0) return { text: 'Trời quang', emoji: '☀️', tone: 'sun' };
  if (code === 1) return { text: 'Ít mây', emoji: '🌤️', tone: 'sun' };
  if (code === 2) return { text: 'Có mây', emoji: '⛅', tone: 'cloud' };
  if (code === 3) return { text: 'Nhiều mây', emoji: '☁️', tone: 'cloud' };
  if (code === 45 || code === 48) return { text: 'Sương mù', emoji: '🌫️', tone: 'cloud' };
  if (code >= 51 && code <= 57) return { text: 'Mưa phùn', emoji: '🌦️', tone: 'rain' };
  if (code >= 61 && code <= 67) return { text: 'Có mưa', emoji: '🌧️', tone: 'rain' };
  if (code >= 71 && code <= 77) return { text: 'Mưa tuyết', emoji: '❄️', tone: 'cloud' };
  if (code >= 80 && code <= 82) return { text: 'Mưa rào', emoji: '🌦️', tone: 'rain' };
  if (code >= 95) return { text: 'Dông bão', emoji: '⛈️', tone: 'storm' };
  return { text: 'Ổn định', emoji: '🌡️', tone: 'cloud' };
}

export async function searchCities(query: string): Promise<WeatherLocation[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=6&language=vi&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không tìm được địa điểm');
  const json = (await res.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
    }>;
  };
  return (json.results || []).map((r) => ({
    name: r.name,
    admin: r.admin1,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    source: 'search',
  }));
}

export async function detectGPSLocation(): Promise<WeatherLocation> {
  if (!('geolocation' in navigator)) {
    throw new Error('Thiết bị không hỗ trợ định vị GPS');
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 120000,
    });
  });

  const lat = Number(pos.coords.latitude.toFixed(4));
  const lon = Number(pos.coords.longitude.toFixed(4));

  let name = `Vị trí (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
  let admin: string | undefined;
  let country: string | undefined;

  try {
    const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=vi`;
    const res = await fetch(revUrl);
    if (res.ok) {
      const json = (await res.json()) as {
        address?: {
          suburb?: string;
          quarter?: string;
          city_district?: string;
          district?: string;
          city?: string;
          town?: string;
          state?: string;
          country?: string;
        };
      };
      const a = json.address;
      if (a) {
        const area = a.city_district || a.district || a.suburb || a.quarter;
        const city = a.city || a.town || a.state;
        name = area && city ? `${area}, ${city}` : city || area || name;
        admin = a.state;
        country = a.country;
      }
    }
  } catch {
    // reverse geocode is optional; keep coordinates label
  }

  const loc: WeatherLocation = {
    name,
    admin,
    country,
    latitude: lat,
    longitude: lon,
    source: 'gps',
  };
  saveLocation(loc);
  return loc;
}

const MODEL_WEIGHTS: Array<{
  key: 'ecmwf_ifs025' | 'icon_seamless' | 'gfs_seamless' | 'best_match';
  id: ModelReading['id'];
  label: string;
  weight: number;
}> = [
  { key: 'ecmwf_ifs025', id: 'ecmwf', label: 'ECMWF (Châu Âu)', weight: 0.45 },
  { key: 'icon_seamless', id: 'icon', label: 'ICON (Đức)', weight: 0.25 },
  { key: 'gfs_seamless', id: 'gfs', label: 'GFS (NOAA Mỹ)', weight: 0.2 },
  { key: 'best_match', id: 'best_match', label: 'Best Match', weight: 0.1 },
];

function computeWeightedAvg(values: Array<{ value: number | null; weight: number }>): {
  avg: number | null;
  spread: number;
} {
  const valid = values.filter((v): v is { value: number; weight: number } =>
    typeof v.value === 'number' && Number.isFinite(v.value)
  );
  if (valid.length === 0) return { avg: null, spread: 0 };

  let sum = 0;
  let totalW = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const item of valid) {
    sum += item.value * item.weight;
    totalW += item.weight;
    if (item.value < min) min = item.value;
    if (item.value > max) max = item.value;
  }

  return {
    avg: totalW > 0 ? sum / totalW : valid[0].value,
    spread: Number((max - min).toFixed(2)),
  };
}

function formatDayLabel(dateStr: string, idx: number): string {
  if (idx === 0) return 'Hôm nay';
  if (idx === 1) return 'Ngày mai';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return `${weekdays[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

export async function fetchAccurateWeather(location: WeatherLocation): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: 'auto',
    forecast_days: '7',
    models: MODEL_WEIGHTS.map((m) => m.key).join(','),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lỗi tải dữ liệu thời tiết (${res.status})`);
  }

  const json = (await res.json()) as {
    current?: Record<string, number>;
    hourly?: Record<string, Array<string | number | null>>;
    daily?: Record<string, Array<string | number | null>>;
  };

  const current = json.current || {};
  const hourly = json.hourly || {};
  const daily = json.daily || {};

  const times = (hourly.time as string[]) || [];
  const nowMs = Date.now();

  // Find index closest to current hour
  let currentHourIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - nowMs);
    if (diff < minDiff) {
      minDiff = diff;
      currentHourIdx = i;
    }
  }

  const getHourlyArr = (field: string, modelKey: string): Array<number | null> => {
    const specific = hourly[`${field}_${modelKey}`] as Array<number | null> | undefined;
    if (specific) return specific;
    return (hourly[field] as Array<number | null> | undefined) || [];
  };

  // Current observed/nowcast temperature from best_match or base
  const observedTemp =
    typeof current.temperature_2m === 'number'
      ? current.temperature_2m
      : typeof current.temperature_2m_best_match === 'number'
        ? current.temperature_2m_best_match
        : 0;

  // Model readings at current hour
  const modelReadings: ModelReading[] = MODEL_WEIGHTS.map((m) => {
    const arr = getHourlyArr('temperature_2m', m.key);
    const val = arr[currentHourIdx];
    return {
      id: m.id,
      label: m.label,
      weight: m.weight,
      currentTemp: typeof val === 'number' ? Number(val.toFixed(1)) : null,
    };
  });

  // Bias correction offset at current hour
  const currentEnsemble = computeWeightedAvg(
    modelReadings.map((m) => ({ value: m.currentTemp, weight: m.weight }))
  );
  const rawNowTemp = currentEnsemble.avg ?? observedTemp;
  const biasOffset = observedTemp - rawNowTemp;

  // Build next 24h hourly forecast with decaying bias correction
  const hourlyList: HourlyForecastItem[] = [];
  const endIdx = Math.min(times.length, currentHourIdx + 24);
  const spreads: number[] = [];

  for (let i = currentHourIdx; i < endIdx; i++) {
    const hoursAhead = i - currentHourIdx;
    const tempResult = computeWeightedAvg(
      MODEL_WEIGHTS.map((m) => ({
        value: getHourlyArr('temperature_2m', m.key)[i] ?? null,
        weight: m.weight,
      }))
    );
    const rawT = tempResult.avg ?? observedTemp;
    const correctedT = rawT + biasOffset * Math.exp(-hoursAhead / 4);
    spreads.push(tempResult.spread);

    const probResult = computeWeightedAvg(
      MODEL_WEIGHTS.map((m) => ({
        value: getHourlyArr('precipitation_probability', m.key)[i] ?? null,
        weight: m.weight,
      }))
    );

    const humArr = getHourlyArr('relative_humidity_2m', 'best_match');
    const codeArr = getHourlyArr('weather_code', 'ecmwf_ifs025');
    const fallbackCodeArr = getHourlyArr('weather_code', 'best_match');

    const timeStr = times[i];
    const hourLabel = hoursAhead === 0 ? 'Bây giờ' : timeStr.slice(11, 16);

    hourlyList.push({
      time: timeStr,
      hourLabel,
      temp: Number(correctedT.toFixed(1)),
      tempRaw: Number(rawT.toFixed(1)),
      spread: tempResult.spread,
      precipProb: Math.round(probResult.avg ?? 0),
      weatherCode: Number(codeArr[i] ?? fallbackCodeArr[i] ?? current.weather_code ?? 0),
      humidity: Math.round(Number(humArr[i] ?? current.relative_humidity_2m ?? 70)),
    });
  }

  // Build 7-day daily ensemble
  const dailyDates = (daily.time as string[]) || [];
  const getDailyArr = (field: string, modelKey: string): Array<number | null> => {
    const specific = daily[`${field}_${modelKey}`] as Array<number | null> | undefined;
    if (specific) return specific;
    return (daily[field] as Array<number | null> | undefined) || [];
  };

  const dailyList: DailyForecastItem[] = dailyDates.map((d, idx) => {
    const minRes = computeWeightedAvg(
      MODEL_WEIGHTS.map((m) => ({
        value: getDailyArr('temperature_2m_min', m.key)[idx] ?? null,
        weight: m.weight,
      }))
    );
    const maxRes = computeWeightedAvg(
      MODEL_WEIGHTS.map((m) => ({
        value: getDailyArr('temperature_2m_max', m.key)[idx] ?? null,
        weight: m.weight,
      }))
    );
    const probRes = computeWeightedAvg(
      MODEL_WEIGHTS.map((m) => ({
        value: getDailyArr('precipitation_probability_max', m.key)[idx] ?? null,
        weight: m.weight,
      }))
    );
    const uvArr = getDailyArr('uv_index_max', 'best_match');
    const codeArr = getDailyArr('weather_code', 'ecmwf_ifs025');
    const fallbackCodeArr = getDailyArr('weather_code', 'best_match');

    return {
      date: d,
      dayLabel: formatDayLabel(d, idx),
      tempMin: Number((minRes.avg ?? 24).toFixed(1)),
      tempMax: Number((maxRes.avg ?? 32).toFixed(1)),
      precipProbMax: Math.round(probRes.avg ?? 0),
      weatherCode: Number(codeArr[idx] ?? fallbackCodeArr[idx] ?? 0),
      uvMax: Number((uvArr[idx] ?? 0).toFixed(1)),
    };
  });

  const avgSpread =
    spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : currentEnsemble.spread;
  // Confidence score: 99% at 0°C spread, dropping ~6% per °C spread
  const confidencePercent = Math.max(72, Math.min(99, Math.round(99 - avgSpread * 6)));
  const confidenceLabel =
    avgSpread <= 0.8
      ? 'Độ đồng thuận rất cao'
      : avgSpread <= 1.6
        ? 'Độ đồng thuận cao'
        : 'Biến động nhẹ giữa các mô hình';

  const currentUv = Number(getHourlyArr('uv_index', 'best_match')[currentHourIdx] ?? 0);

  const data: WeatherData = {
    location,
    updatedAt: Date.now(),
    current: {
      temp: Number(observedTemp.toFixed(1)),
      apparentTemp: Number((current.apparent_temperature ?? observedTemp).toFixed(1)),
      humidity: Math.round(current.relative_humidity_2m ?? 70),
      windSpeed: Number((current.wind_speed_10m ?? 0).toFixed(1)),
      weatherCode: Number(current.weather_code ?? 0),
      precip: Number((current.precipitation ?? 0).toFixed(1)),
      uvIndex: Number(currentUv.toFixed(1)),
      isDay: current.is_day !== 0,
    },
    confidence: {
      percent: confidencePercent,
      spreadC: Number(avgSpread.toFixed(1)),
      label: confidenceLabel,
    },
    models: modelReadings,
    hourly: hourlyList,
    daily: dailyList,
  };

  saveWeatherCache(data);
  return data;
}
