import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Wind,
  X,
} from 'lucide-react';
import {
  describeWeatherCode,
  detectGPSLocation,
  fetchAccurateWeather,
  getCachedWeather,
  getSavedLocation,
  saveLocation,
  searchCities,
  type WeatherData,
  type WeatherLocation,
} from '../lib/weather';

export function WeatherCard({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [weather, setWeather] = useState<WeatherData | null>(() => getCachedWeather());
  const [location, setLocation] = useState<WeatherLocation>(() => getSavedLocation());
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  async function loadWeather(targetLoc: WeatherLocation, force = false) {
    if (!force) {
      const cached = getCachedWeather();
      if (
        cached &&
        Math.abs(cached.location.latitude - targetLoc.latitude) < 0.01 &&
        Math.abs(cached.location.longitude - targetLoc.longitude) < 0.01
      ) {
        setWeather(cached);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchAccurateWeather(targetLoc);
      setWeather(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu thời tiết');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeather(location);
  }, []);

  async function handleGPS() {
    setLocating(true);
    setError('');
    try {
      const gpsLoc = await detectGPSLocation();
      setLocation(gpsLoc);
      setSearchOpen(false);
      await loadWeather(gpsLoc, true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không lấy được GPS. Hãy cấp quyền vị trí hoặc tìm tên thành phố.'
      );
    } finally {
      setLocating(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError('');
    try {
      const list = await searchCities(query);
      setResults(list);
      if (list.length === 0) {
        setError('Không tìm thấy địa điểm phù hợp.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tìm kiếm địa điểm');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectCity(city: WeatherLocation) {
    saveLocation(city);
    setLocation(city);
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    await loadWeather(city, true);
  }

  const desc = describeWeatherCode(weather?.current.weatherCode ?? 0);

  const toneGradient =
    desc.tone === 'sun'
      ? 'from-sky-500 via-blue-600 to-indigo-600 shadow-sky-500/20'
      : desc.tone === 'rain'
        ? 'from-slate-700 via-sky-800 to-indigo-900 shadow-slate-700/20'
        : desc.tone === 'storm'
          ? 'from-slate-800 via-indigo-900 to-violet-950 shadow-indigo-900/25'
          : 'from-sky-600 via-cyan-700 to-teal-700 shadow-cyan-600/20';

  // Compute global min/max across 7 days for range bars
  const weekMin = weather?.daily.length
    ? Math.min(...weather.daily.map((d) => d.tempMin))
    : 20;
  const weekMax = weather?.daily.length
    ? Math.max(...weather.daily.map((d) => d.tempMax))
    : 35;
  const weekSpan = Math.max(1, weekMax - weekMin);

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-900/6">
      {/* Top Gradient Banner */}
      <div className={`relative bg-gradient-to-br ${toneGradient} p-4 text-white shadow-lg`}>
        <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />

        {/* Location + Action Buttons */}
        <div className="relative flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{weather?.location.name || location.name}</span>
            {location.source === 'gps' && (
              <span className="rounded-full bg-emerald-400/30 px-1.5 py-0.5 text-[9px] font-bold">
                GPS
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleGPS}
              disabled={locating}
              title="Định vị GPS chính xác"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90 disabled:opacity-50"
              aria-label="Lấy vị trí GPS"
            >
              <LocateFixed className={`h-3.5 w-3.5 ${locating ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              title="Đổi thành phố"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90"
              aria-label="Tìm thành phố"
            >
              {searchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => loadWeather(location, true)}
              disabled={loading}
              title="Cập nhật mới nhất"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-90 disabled:opacity-50"
              aria-label="Làm mới thời tiết"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* City Search Drawer */}
        {searchOpen && (
          <div className="relative mt-3 rounded-2xl bg-white/95 p-2.5 text-slate-900 shadow-lg">
            <form onSubmit={handleSearch} className="flex gap-1.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên quận/thành phố (vd: Hà Nội, Đà Nẵng)..."
                className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
              >
                {searching ? '...' : 'Tìm'}
              </button>
            </form>
            {results.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {results.map((c, idx) => (
                  <button
                    key={`${c.latitude}-${c.longitude}-${idx}`}
                    type="button"
                    onClick={() => handleSelectCity(c)}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-sky-50"
                  >
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {[c.admin, c.country].filter(Boolean).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Temperature & Metrics */}
        {weather ? (
          <div className="relative mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none">{desc.emoji}</span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular-nums text-3xl font-extrabold tracking-tight">
                    {weather.current.temp.toFixed(1)}°C
                  </span>
                  <span className="text-xs font-medium text-white/80">
                    Cảm giác {weather.current.apparentTemp.toFixed(1)}°
                  </span>
                </div>
                <div className="mt-0.5 text-xs font-medium text-white/90">
                  {desc.text} • Hôm nay {weather.daily[0]?.tempMin.toFixed(0)}°–
                  {weather.daily[0]?.tempMax.toFixed(0)}°
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
            >
              <span>{expanded ? 'Thu gọn' : 'Chi tiết'}</span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : (
          <div className="mt-3 py-2 text-xs text-white/90">
            {loading ? 'Đang tổng hợp dữ liệu từ ECMWF, ICON & GFS...' : 'Chưa có dữ liệu thời tiết.'}
          </div>
        )}

        {/* Quick Metrics & Ensemble Confidence Bar */}
        {weather && (
          <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2.5 text-[11px] text-white/90">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Droplets className="h-3 w-3" /> {weather.current.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3 w-3" /> {weather.current.windSpeed} km/h
              </span>
              <span className="flex items-center gap-1">
                <Sun className="h-3 w-3" /> UV {weather.current.uvIndex}
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] font-semibold text-white">
              <ShieldCheck className="h-3 w-3" />
              <span>
                Tin cậy {weather.confidence.percent}% (±{weather.confidence.spreadC}°C)
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-xl bg-rose-500/80 px-2.5 py-1.5 text-[11px] font-medium text-white">
            {error}
          </div>
        )}
      </div>

      {/* Always-visible Next Hours Strip (when collapsed) */}
      {!expanded && weather && weather.hourly.length > 1 && (
        <div className="bg-white px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-700">Dự báo vài giờ tới</span>
            <span className="text-[10px] font-medium text-slate-400">
              Nhiệt độ & khả năng mưa
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {weather.hourly.slice(1, 7).map((h) => {
              const hDesc = describeWeatherCode(h.weatherCode);
              return (
                <div
                  key={h.time}
                  className="flex flex-col items-center rounded-xl bg-slate-50 py-1.5 text-center ring-1 ring-slate-900/5"
                >
                  <span className="text-[10px] font-semibold text-slate-500">{h.hourLabel}</span>
                  <span className="my-0.5 text-base leading-none">{hDesc.emoji}</span>
                  <span className="tabular-nums text-[11px] font-bold text-slate-900">
                    {h.temp.toFixed(1)}°
                  </span>
                  <span className="text-[9px] font-medium text-sky-600">
                    {h.precipProb > 0 ? `💧${h.precipProb}%` : `${h.humidity}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded Multi-Model Forecast */}
      {expanded && weather && (
        <div className="space-y-4 p-4">
          {/* 24h Hourly Forecast */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Dự báo 24 giờ tới</span>
              <span className="text-[10px] font-medium text-slate-400">
                Đã hiệu chỉnh sai số thực tế
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {weather.hourly.map((h) => {
                const hDesc = describeWeatherCode(h.weatherCode);
                return (
                  <div
                    key={h.time}
                    className="flex min-w-[60px] flex-col items-center rounded-2xl bg-slate-50 px-2 py-2 text-center ring-1 ring-slate-900/5"
                  >
                    <span className="text-[10px] font-semibold text-slate-500">{h.hourLabel}</span>
                    <span className="my-1 text-lg leading-none">{hDesc.emoji}</span>
                    <span className="tabular-nums text-xs font-bold text-slate-900">
                      {h.temp.toFixed(1)}°
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium text-sky-600">
                      {h.precipProb > 0 ? `💧${h.precipProb}%` : `${h.humidity}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7-Day Forecast */}
          <div>
            <div className="mb-2 text-xs font-bold text-slate-800">Dự báo 7 ngày</div>
            <div className="space-y-2">
              {weather.daily.map((d) => {
                const dDesc = describeWeatherCode(d.weatherCode);
                const leftPct = ((d.tempMin - weekMin) / weekSpan) * 100;
                const widthPct = Math.max(8, ((d.tempMax - d.tempMin) / weekSpan) * 100);
                return (
                  <div
                    key={d.date}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="w-20 shrink-0 font-semibold text-slate-700">{d.dayLabel}</span>
                    <span className="w-6 text-center text-base leading-none">{dDesc.emoji}</span>
                    <span className="w-9 text-right text-[10px] font-medium text-sky-600">
                      {d.precipProbMax > 10 ? `${d.precipProbMax}%` : ''}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <span className="tabular-nums w-8 text-right text-[11px] font-medium text-slate-500">
                        {d.tempMin.toFixed(0)}°
                      </span>
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-orange-500"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        />
                      </div>
                      <span className="tabular-nums w-8 text-[11px] font-bold text-slate-800">
                        {d.tempMax.toFixed(0)}°
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multi-model Ensemble Breakdown */}
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-900/5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">
                Đối chiếu đa mô hình (Ensemble)
              </span>
              <span className="text-[10px] font-medium text-emerald-600">
                {weather.confidence.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {weather.models.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl bg-white px-2.5 py-1.5 text-[11px] ring-1 ring-slate-900/5"
                >
                  <span className="text-slate-600">
                    {m.label} <span className="text-[9px] text-slate-400">({Math.round(m.weight * 100)}%)</span>
                  </span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {m.currentTemp !== null ? `${m.currentTemp}°` : '--'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
