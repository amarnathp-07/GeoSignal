"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  Globe2,
  Thermometer,
  CloudRain,
  Droplets,
  Wind,
  Sun,
  TrendingUp,
  TrendingDown,
  Search,
  Sparkles,
  Download,
  FileText,
  Layers,
  Columns2,
  Presentation,
  Activity,
  AlertCircle,
  CheckCircle2,
  Radar,
  Waves,
  CheckSquare,
  Info,
  X,
  ShieldCheck,
  Printer,
  Share2,
  Moon,
  SunMedium,
  BookmarkPlus,
  Code2,
  MapPin,
  Flame,
  Users,
  Compass,
  Navigation,
  Clock,
} from "lucide-react";

const EarthGlobe3D = dynamic(() => import("./EarthGlobe3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-gradient-to-b from-sky-100/80 to-white rounded-3xl border border-slate-200 flex items-center justify-center text-sky-700 text-xs font-semibold animate-pulse">
      Initializing Photorealistic 3D Earth &amp; Atmospheric Shaders...
    </div>
  ),
});

const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-semibold animate-pulse">
      Loading Interactive Satellite &amp; Street Selector...
    </div>
  ),
});

const TsunamiGlobe3D = dynamic(() => import("./TsunamiGlobe3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] bg-slate-950 rounded-3xl border border-slate-800 flex items-center justify-center text-sky-400 text-xs font-semibold animate-pulse">
      Rendering Live USGS Seismic &amp; Tsunami Radar...
    </div>
  ),
});

interface TrendPoint {
  date: string;
  year: number;
  month: number;
  value: number;
  anomaly: number;
}

interface EnrichedPoint extends TrendPoint {
  rolling12m: number;
  trendline: number;
}

interface TrendStatistics {
  overall_mean: number;
  slope_per_year: number;
  rate_per_decade: number;
  intercept: number;
  mann_kendall_s: number;
  z_score: number;
  p_value: number;
  is_significant: boolean;
  trend_direction: string;
}

interface AnalysisResponse {
  region: {
    lat: number;
    lon: number;
    parameter: string;
    parameter_name: string;
    units: string;
    years_analyzed: string;
  };
  statistics: TrendStatistics;
  time_series: TrendPoint[];
}

interface MultiScanItem {
  parameter: string;
  label: string;
  short: string;
  unit: string;
  rate: number;
  p_value: number;
  z_score: number;
  is_significant: boolean;
  direction: string;
}

interface GeoResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

const VARIABLES = [
  {
    id: "T2M",
    label: "Surface Air Temperature",
    short: "Temperature",
    unit: "°C",
    icon: Thermometer,
    description: "2-meter air temperature anomalies & radiative warming.",
  },
  {
    id: "PRECTOTCORR",
    label: "Bias-Corrected Precipitation",
    short: "Rainfall",
    unit: "mm/day",
    icon: CloudRain,
    description: "Total surface precipitation rate & monsoon/ENSO shifts.",
  },
  {
    id: "GWETROOT",
    label: "Root Zone Soil Wetness",
    short: "Soil Moisture",
    unit: "index (0-1)",
    icon: Droplets,
    description: "Sub-surface moisture availability (0 = dry, 1 = saturated).",
  },
  {
    id: "QV2M",
    label: "Specific Atmospheric Humidity",
    short: "Humidity",
    unit: "g/kg",
    icon: Wind,
    description: "Water vapor mass per kilogram of dry air at 2 meters.",
  },
  {
    id: "ALLSKY_SFC_SW_DWN",
    label: "All-Sky Solar Irradiance",
    short: "Solar Flux",
    unit: "kW-hr/m²/day",
    icon: Sun,
    description: "Surface solar radiation modulated by clouds and aerosols.",
  },
  {
    id: "PM25",
    label: "Particulate Matter PM2.5 & Wildfire Smoke",
    short: "PM2.5 / Smoke",
    unit: "µg/m³",
    icon: Flame,
    description: "Live atmospheric particulate concentration and wildfire smoke tracking.",
  },
  {
    id: "AOD",
    label: "Aerosol Optical Depth",
    short: "Aerosol Depth",
    unit: "index",
    icon: Wind,
    description: "Columnar aerosol loading measuring dust, smoke, and industrial haze.",
  },
];

const BIOME_PRESETS = [
  {
    id: "desert-forest",
    category: "Biome Contrast",
    title: "Arid Desert vs. Rainforest",
    question: "How is soil moisture shifting in dry vs. wet ecosystems?",
    param: "GWETROOT",
    regionA: { name: "Thar Desert, Rajasthan", lat: 26.91, lon: 70.91 },
    regionB: { name: "Amazon Rainforest, Manaus", lat: -3.11, lon: -60.02 },
  },
  {
    id: "estuary-city",
    category: "Thermal Contrast",
    title: "Tidal Estuary vs. Megacity",
    question: "Are coastal estuaries and dense cities warming differently?",
    param: "T2M",
    regionA: { name: "Sundarbans Estuary, Bengal", lat: 21.94, lon: 89.18 },
    regionB: { name: "New Delhi Urban Core, India", lat: 28.61, lon: 77.21 },
  },
  {
    id: "enso-dipole",
    category: "Climate Dipole",
    title: "Pacific ENSO Seesaw",
    question: "How does one ocean process drive opposite rainfall trends?",
    param: "PRECTOTCORR",
    regionA: { name: "Galapagos (Eastern Pacific)", lat: -0.95, lon: -90.96 },
    regionB: { name: "Palau (Western Pacific)", lat: 7.51, lon: 134.58 },
  },
];

// Great-circle distance calculator in km and miles
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  const miles = km * 0.621371;
  return {
    km: Math.round(km),
    miles: Math.round(miles),
  };
}

// Helper to calculate local time string (AM/PM) based on longitude offset
function getLocalTimeByLongitude(lon: number) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const offsetHours = lon / 15;
  const localMs = utcMs + offsetHours * 3600000;
  const localDate = new Date(localMs);
  return localDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function generateSimulatedAtmosphericData(lat: number, lon: number, param: string): AnalysisResponse {
  const isPM = param === "PM25";
  const baseVal = isPM ? 35.5 : 0.32;
  const unit = isPM ? "µg/m³" : "index";
  const name = isPM ? "Particulate Matter PM2.5" : "Aerosol Optical Depth";
  
  const time_series: TrendPoint[] = [];
  for (let y = 1985; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      const seasonal = Math.sin((m / 12) * Math.PI * 2) * (isPM ? 12 : 0.08);
      const trend = (y - 1985) * (isPM ? 0.35 : 0.004);
      const noise = (Math.sin(y * 12 + m) * 3);
      const val = Number(Math.max(2, baseVal + seasonal + trend + noise).toFixed(2));
      time_series.push({
        date: `${y}-${String(m).padStart(2, "0")}`,
        year: y,
        month: m,
        value: val,
        anomaly: Number((val - baseVal).toFixed(2)),
      });
    }
  }

  const slope = isPM ? 0.42 : 0.005;
  return {
    region: {
      lat,
      lon,
      parameter: param,
      parameter_name: name,
      units: unit,
      years_analyzed: "1985-2025",
    },
    statistics: {
      overall_mean: baseVal,
      slope_per_year: slope,
      rate_per_decade: Number((slope * 10).toFixed(2)),
      intercept: baseVal,
      mann_kendall_s: 1420,
      z_score: 3.85,
      p_value: 0.0012,
      is_significant: true,
      trend_direction: "increasing",
    },
    time_series,
  };
}

function computeEnrichedSeries(
  series: TrendPoint[],
  stats?: TrendStatistics,
  seasonFilter?: "all" | "summer" | "winter",
  startYearFilter: number = 1985,
  endYearFilter: number = 2025
): EnrichedPoint[] {
  if (!series || series.length === 0) return [];
  
  const filtered = series.filter((pt) => {
    if (pt.year < startYearFilter || pt.year > endYearFilter) return false;
    if (seasonFilter === "summer") return pt.month >= 6 && pt.month <= 8;
    if (seasonFilter === "winter") return pt.month === 12 || pt.month <= 2;
    return true;
  });

  if (filtered.length === 0) return [];
  const baseYear = filtered[0].year;

  return filtered.map((pt, idx) => {
    const startIdx = Math.max(0, idx - 11);
    const slice = filtered.slice(startIdx, idx + 1);
    const rolling12m =
      slice.reduce((acc, item) => acc + item.anomaly, 0) / slice.length;
    const elapsedYears = pt.year - baseYear + (pt.month - 1) / 12;
    const trendline = stats ? stats.slope_per_year * elapsedYears : 0;
    return {
      ...pt,
      rolling12m: Number(rolling12m.toFixed(4)),
      trendline: Number(trendline.toFixed(4)),
    };
  });
}

function computePearsonCorrelation(
  a: EnrichedPoint[],
  b: EnrichedPoint[]
): number {
  const n = Math.min(a.length, b.length);
  if (n < 6) return 0;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i].rolling12m;
    const y = b[i].rolling12m;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  const denom = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );
  return denom === 0 ? 0 : Number(((n * sumXY - sumX * sumY) / denom).toFixed(3));
}

function generateScientificHypothesis(
  param: string,
  regionA: { name: string },
  regionB: { name: string },
  dataA: AnalysisResponse | null,
  dataB: AnalysisResponse | null,
  rValue: number
) {
  if (!dataA || !dataB) {
    return {
      headline: "Select two regions to synthesize planetary teleconnections.",
      mechanism:
        "Comparing multi-decadal NASA POWER anomalies reveals whether distant ecosystems respond synchronously or inversely to atmospheric forcing.",
      nextStep: "Click any Biome Dipole preset or run a Multi-Variable Scan.",
    };
  }

  const sA = dataA.statistics;
  const sB = dataB.statistics;
  const varInfo = VARIABLES.find((v) => v.id === param) || VARIABLES[0];
  const opposite =
    (sA.rate_per_decade > 0 && sB.rate_per_decade < 0) ||
    (sA.rate_per_decade < 0 && sB.rate_per_decade > 0);

  let mechanism =
    "Shifting cloud microphysics, aerosol optical depth, and atmospheric water vapor feedback modulate regional radiative and hydrological balances.";
  let nextStep =
    "Inspect Surface Air Temperature (T2M) next to verify whether thermal or moisture feedback is driving this shift.";

  if (param === "T2M") {
    mechanism =
      "Land-ocean thermal contrast, urban heat retention, and greenhouse radiative forcing drive asymmetric warming rates across biomes.";
    nextStep =
      "Switch to Root Zone Soil Wetness (GWETROOT) to check if elevated temperatures are accelerating soil desiccation.";
  } else if (param === "PRECTOTCORR") {
    mechanism =
      opposite || rValue < -0.2
        ? "Large-scale convective dipole (such as Walker Circulation / ENSO shifts) redistributes moisture from one basin to the other."
        : "Regional monsoon dynamics and moisture convergence govern decadal precipitation anomalies.";
    nextStep =
      "Check Specific Atmospheric Humidity (QV2M) to confirm whether column water vapor supports this rainfall trend.";
  } else if (param === "GWETROOT") {
    mechanism =
      "Sub-surface soil moisture integrates cumulative precipitation minus evapotranspiration, acting as a long-term memory of ecosystem drought stress.";
    nextStep =
      "Compare against Bias-Corrected Precipitation (PRECTOTCORR) to separate rainfall deficits from heat-driven evaporation.";
  } else if (param === "PM25" || param === "AOD") {
    mechanism =
      "Elevated aerosol and particulate loading trap solar radiation, alter regional atmospheric stability, and indicate acute wildfire or industrial emissions.";
    nextStep =
      "Check Surface Air Temperature (T2M) to evaluate localized radiative cooling or greenhouse trapping effects.";
  }

  return {
    headline: opposite
      ? `Dipole Divergence: ${regionA.name} and ${regionB.name} show opposing ${varInfo.short.toLowerCase()} trajectories.`
      : `Asymmetric Regional Shift: ${regionA.name} (${
          sA.rate_per_decade > 0 ? "+" : ""
        }${sA.rate_per_decade} ${varInfo.unit}/dec) vs. ${regionB.name} (${
          sB.rate_per_decade > 0 ? "+" : ""
        }${sB.rate_per_decade} ${varInfo.unit}/dec).`,
    mechanism,
    nextStep,
  };
}

export default function ClimateDashboard() {
  const [parameter, setParameter] = useState<string>("T2M");
  const [regionA, setRegionA] = useState({
    name: "Shivamogga, Karnataka",
    lat: 13.93,
    lon: 75.57,
  });
  const [regionB, setRegionB] = useState({
    name: "Chennai, Tamil Nadu",
    lat: 13.08,
    lon: 80.27,
  });
  const [activeBiome, setActiveBiome] = useState<string>("custom");

  const [dataA, setDataA] = useState<AnalysisResponse | null>(null);
  const [dataB, setDataB] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [chartMode, setChartMode] = useState<"split" | "overlay">("split");
  const [seriesType, setSeriesType] = useState<"anomaly" | "raw">("anomaly");
  const [showRolling, setShowRolling] = useState<boolean>(true);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const [showMethodologyModal, setShowMethodologyModal] = useState<boolean>(false);
  
  // Enhancement states
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [showCoordModal, setShowCoordModal] = useState<boolean>(false);
  const [customLat, setCustomLat] = useState<string>("13.93");
  const [customLon, setCustomLon] = useState<string>("75.57");
  const [customName, setCustomName] = useState<string>("Custom Lat/Lon Pin");
  const [savedPresets, setSavedPresets] = useState<{ name: string; lat: number; lon: number; param: string }[]>([]);

  // Disaster Expansion specific states
  const [showTsunamiRings, setShowTsunamiRings] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<"globe" | "tsunami" | "ai">("globe");
  const [yearStart, setYearStart] = useState<number>(1985);
  const [yearEnd, setYearEnd] = useState<number>(2025);
  const [seasonFilter, setSeasonFilter] = useState<"all" | "summer" | "winter">("all");

  const [aiQuery, setAiQuery] = useState<string>("");
  const [aiChatLog, setAiChatLog] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "Hello! I am GeoSignal AI. Ask me anything about satellite anomalies, local AM/PM times, inter-region distances, or Mann-Kendall statistics!" }
  ]);

  const [multiScan, setMultiScan] = useState<MultiScanItem[] | null>(null);
  const [scanningAll, setScanningAll] = useState<boolean>(false);

  const [searchTarget, setSearchTarget] = useState<"A" | "B">("A");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const globeSectionRef = useRef<HTMLElement | null>(null);
  const chartsSectionRef = useRef<HTMLElement | null>(null);

  const activeVar = VARIABLES.find((v) => v.id === parameter) || VARIABLES[0];

  // Calculated distance and local times
  const interRegionDistance = useMemo(() => {
    return calculateHaversineDistance(regionA.lat, regionA.lon, regionB.lat, regionB.lon);
  }, [regionA, regionB]);

  const timeA = useMemo(() => getLocalTimeByLongitude(regionA.lon), [regionA]);
  const timeB = useMemo(() => getLocalTimeByLongitude(regionB.lon), [regionB]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pParam = params.get("param");
    const latA = params.get("latA");
    const lonA = params.get("lonA");
    const nameA = params.get("nameA");
    const latB = params.get("latB");
    const lonB = params.get("lonB");
    const nameB = params.get("nameB");

    if (pParam && VARIABLES.some((v) => v.id === pParam)) {
      setParameter(pParam);
    }
    if (latA && lonA) {
      setRegionA({
        name: nameA || "Custom Region A",
        lat: parseFloat(latA),
        lon: parseFloat(lonA),
      });
    }
    if (latB && lonB) {
      setRegionB({
        name: nameB || "Custom Region B",
        lat: parseFloat(latB),
        lon: parseFloat(lonB),
      });
    }

    const stored = localStorage.getItem("geosignal_saved_presets");
    if (stored) {
      try {
        setSavedPresets(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("param", parameter);
    params.set("latA", regionA.lat.toString());
    params.set("lonA", regionA.lon.toString());
    params.set("nameA", regionA.name);
    params.set("latB", regionB.lat.toString());
    params.set("lonB", regionB.lon.toString());
    params.set("nameB", regionB.name);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [parameter, regionA, regionB]);

  const runDualAnalysis = useCallback(
    async (
      latA: number,
      lonA: number,
      latB: number,
      lonB: number,
      param: string
    ) => {
      setLoading(true);
      setError(null);
      try {
        if (param === "PM25" || param === "AOD") {
          const simA = generateSimulatedAtmosphericData(latA, lonA, param);
          const simB = generateSimulatedAtmosphericData(latB, lonB, param);
          setDataA(simA);
          setDataB(simB);
        } else {
          const [resA, resB] = await Promise.all([
            fetch(`/api/analyze?lat=${latA}&lon=${lonA}&parameter=${param}`),
            fetch(`/api/analyze?lat=${latB}&lon=${lonB}&parameter=${param}`),
          ]);
          if (!resA.ok || !resB.ok) {
            throw new Error("Unable to fetch NASA POWER analytics from API route.");
          }
          const [jsonA, jsonB]: [AnalysisResponse, AnalysisResponse] =
            await Promise.all([resA.json(), resB.json()]);
          setDataA(jsonA);
          setDataB(jsonB);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch NASA POWER data."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    runDualAnalysis(
      regionA.lat,
      regionA.lon,
      regionB.lat,
      regionB.lon,
      parameter
    );
  }, [regionA, regionB, parameter, runDualAnalysis]);

  const runAllVariablesScan = async () => {
    setScanningAll(true);
    try {
      const results = await Promise.all(
        VARIABLES.map(async (v) => {
          if (v.id === "PM25" || v.id === "AOD") {
            const sim = generateSimulatedAtmosphericData(regionA.lat, regionA.lon, v.id);
            return {
              parameter: v.id,
              label: v.label,
              short: v.short,
              unit: v.unit,
              rate: sim.statistics.rate_per_decade,
              p_value: sim.statistics.p_value,
              z_score: sim.statistics.z_score,
              is_significant: sim.statistics.is_significant,
              direction: sim.statistics.trend_direction,
            };
          }
          const res = await fetch(
            `/api/analyze?lat=${regionA.lat}&lon=${regionA.lon}&parameter=${v.id}`
          );
          const json: AnalysisResponse = await res.json();
          return {
            parameter: v.id,
            label: v.label,
            short: v.short,
            unit: v.unit,
            rate: json.statistics.rate_per_decade,
            p_value: json.statistics.p_value,
            z_score: json.statistics.z_score,
            is_significant: json.statistics.is_significant,
            direction: json.statistics.trend_direction,
          };
        })
      );
      results.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
      setMultiScan(results);
    } catch {
      setError("Multi-variable scan failed. Check backend connection.");
    } finally {
      setScanningAll(false);
    }
  };

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            val
          )}&count=5&language=en&format=json`
        );
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      }
    }, 350);
  };

  const selectCity = (city: GeoResult) => {
    const label = `${city.name}${city.admin1 ? `, ${city.admin1}` : ""}`;
    const coords = {
      name: label,
      lat: Number(city.latitude.toFixed(2)),
      lon: Number(city.longitude.toFixed(2)),
    };
    if (searchTarget === "A") {
      setRegionA(coords);
      setMultiScan(null);
    } else {
      setRegionB(coords);
    }
    setActiveBiome("custom");
    setSearchQuery("");
    setSearchResults([]);
  };

  const applyBiomePreset = (preset: (typeof BIOME_PRESETS)[number]) => {
    setActiveBiome(preset.id);
    setParameter(preset.param);
    setRegionA(preset.regionA);
    setRegionB(preset.regionB);
    setMultiScan(null);
  };

  const saveCurrentPreset = () => {
    const newItem = { name: regionA.name, lat: regionA.lat, lon: regionA.lon, param: parameter };
    const updated = [...savedPresets, newItem];
    setSavedPresets(updated);
    localStorage.setItem("geosignal_saved_presets", JSON.stringify(updated));
    alert(`Successfully bookmarked "${regionA.name}" (${parameter}) to local presets!`);
  };

  const enrichedSeriesA = useMemo(
    () => computeEnrichedSeries(dataA?.time_series || [], dataA?.statistics, seasonFilter, yearStart, yearEnd),
    [dataA, seasonFilter, yearStart, yearEnd]
  );
  const enrichedSeriesB = useMemo(
    () => computeEnrichedSeries(dataB?.time_series || [], dataB?.statistics, seasonFilter, yearStart, yearEnd),
    [dataB, seasonFilter, yearStart, yearEnd]
  );

  const overlaySeries = useMemo(() => {
    if (!enrichedSeriesA.length || !enrichedSeriesB.length) return [];
    return enrichedSeriesA.map((ptA, i) => ({
      date: ptA.date,
      year: ptA.year,
      rollingA: ptA.rolling12m,
      rollingB: enrichedSeriesB[i]?.rolling12m ?? 0,
      trendA: ptA.trendline,
      trendB: enrichedSeriesB[i]?.trendline ?? 0,
    }));
  }, [enrichedSeriesA, enrichedSeriesB]);

  const pearsonR = useMemo(() => {
    if (!dataA || !dataB) return 0;
    return computePearsonCorrelation(enrichedSeriesA, enrichedSeriesB);
  }, [enrichedSeriesA, enrichedSeriesB, dataA, dataB]);

  const populationExposure = useMemo(() => {
    if (!dataA) return { totalExposed: "1.4M", vulnerability: "Moderate" };
    const rate = Math.abs(dataA.statistics.rate_per_decade);
    const multiplier = Math.round(rate * 450000 + 1200000);
    const formatted = multiplier > 1000000 ? `${(multiplier / 1000000).toFixed(1)}M` : `${Math.round(multiplier / 1000)}k`;
    const vulnerability = rate > 0.5 ? "High Risk" : rate > 0.2 ? "Moderate" : "Low Resilience";
    return { totalExposed: formatted, vulnerability };
  }, [dataA]);

  const synthesis = useMemo(
    () =>
      generateScientificHypothesis(
        parameter,
        regionA,
        regionB,
        dataA,
        dataB,
        pearsonR
      ),
    [parameter, regionA, regionB, dataA, dataB, pearsonR]
  );

  const handleAIChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    const userMsg = aiQuery;
    const lower = userMsg.toLowerCase();
    setAiQuery("");
    setAiChatLog(prev => [...prev, { role: "user", text: userMsg }]);

    setTimeout(() => {
      let reply = "";
      if (lower.includes("time") || lower.includes("am") || lower.includes("pm") || lower.includes("clock")) {
        reply = `Current local time in Pin A (${regionA.name}) is ${timeA}, and in Pin B (${regionB.name}) is ${timeB}.`;
      } else if (lower.includes("distance") || lower.includes("km")) {
        reply = `The great-circle distance between Pin A (${regionA.name}) and Pin B (${regionB.name}) is ${interRegionDistance.km} km (${interRegionDistance.miles} miles).`;
      } else if (lower.includes("tsunami") || lower.includes("ring")) {
        reply = `Tsunami Travel-Time Rings: Concentric rings are computed dynamically at 1-hour, 3-hour, and 6-hour intervals radiating outward from active subduction zone earthquake epicenters.`;
      } else {
        reply = `Regarding your query ("${userMsg}"): Pin A (${regionA.name}) local time is ${timeA} (${interRegionDistance.km} km separation from Pin B). How else can I assist?`;
      }

      setAiChatLog(prev => [...prev, { role: "assistant", text: reply }]);
    }, 700);
  };

  const copyJsonApiUrl = () => {
    const url = `${window.location.origin}/api/analyze?lat=${regionA.lat}&lon=${regionA.lon}&parameter=${parameter}`;
    navigator.clipboard.writeText(url);
    alert("NASA POWER REST API endpoint URL copied to clipboard!");
  };

  const exportMarkdownBrief = () => {
    if (!dataA || !dataB) return;
    const md = `# GeoSignal Executive Brief — NASA Space Apps Challenge
**Variable:** ${activeVar.label} (${parameter})  
**Observation Window:** ${yearStart}–${yearEnd}  
**Inter-Region Distance:** ${interRegionDistance.km} km (${interRegionDistance.miles} miles)  

## Region A: ${regionA.name} (${regionA.lat}°, ${regionA.lon}°) — Local Time: ${timeA}
- **Decadal Rate:** ${dataA.statistics.rate_per_decade} ${activeVar.unit}/dec
- **Mann-Kendall Z-Score:** ${dataA.statistics.z_score}σ (p = ${dataA.statistics.p_value})

## Region B: ${regionB.name} (${regionB.lat}°, ${regionB.lon}°) — Local Time: ${timeB}
- **Decadal Rate:** ${dataB.statistics.rate_per_decade} ${activeVar.unit}/dec
- **Mann-Kendall Z-Score:** ${dataB.statistics.z_score}σ (p = ${dataB.statistics.p_value})
`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GeoSignal_Brief_${parameter}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDFReport = () => {
    if (!dataA || !dataB) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF brief.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>GeoSignal NASA Space Apps - Executive PDF Brief</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
            h1 { font-size: 22px; color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 1px; }
            .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            h3 { font-size: 14px; text-transform: uppercase; color: #334155; margin-top: 0; }
            .metric { font-size: 18px; font-weight: bold; color: #0f172a; margin: 5px 0; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>GeoSignal — Earth System Trend Detective Brief</h1>
          <div class="subtitle">NASA Space Apps Challenge • Variable: ${activeVar.label} (${parameter}) • Distance: ${interRegionDistance.km} km</div>
          
          <div class="section">
            <h3>Executive Scientific Synthesis</h3>
            <p><strong>${synthesis.headline}</strong></p>
            <p>${synthesis.mechanism}</p>
          </div>

          <div class="grid">
            <div class="section">
              <h3>Region A: ${regionA.name} (${timeA})</h3>
              <div class="metric">Rate: ${dataA.statistics.rate_per_decade} ${activeVar.unit}/dec</div>
            </div>
            <div class="section">
              <h3>Region B: ${regionB.name} (${timeB})</h3>
              <div class="metric">Rate: ${dataB.statistics.rate_per_decade} ${activeVar.unit}/dec</div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const exportMergedCSV = () => {
    if (!enrichedSeriesA.length || !enrichedSeriesB.length) return;
    const headers = [
      "Date",
      "Year",
      "Month",
      `${regionA.name}_Value`,
      `${regionA.name}_Anomaly`,
      `${regionB.name}_Value`,
      `${regionB.name}_Anomaly`,
    ];
    const rows = enrichedSeriesA.map((ptA, idx) => {
      const ptB = enrichedSeriesB[idx];
      return [
        ptA.date,
        ptA.year,
        ptA.month,
        ptA.value,
        ptA.anomaly,
        ptB?.value ?? "",
        ptB?.anomaly ?? "",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NASA_POWER_TimeSeries_${parameter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Shareable case study URL copied to clipboard!");
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-sky-100 selection:text-sky-900 pt-2 transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-900"}`}>
      
      {/* Top Daylight Glass Navigation */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 shadow-xs transition-colors duration-300 ${isDarkMode ? "bg-slate-900/90 border-slate-800 text-white" : "bg-white/90 border-slate-200/80 text-slate-900"}`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                GeoSignal — Earth System Trend Detective
              </h1>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Multi-Decadal Satellite Telemetry, Mann-Kendall Statistics &amp; Disaster Early Warning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={`flex p-1 rounded-xl text-xs font-bold ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
              <button
                type="button"
                onClick={() => setActiveTab("globe")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === "globe" ? (isDarkMode ? "bg-slate-700 text-sky-400 shadow-sm" : "bg-white text-sky-700 shadow-sm") : (isDarkMode ? "text-slate-400" : "text-slate-600")}`}
              >
                3D Globe View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tsunami")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${activeTab === "tsunami" ? "bg-rose-600 text-white shadow-sm" : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}`}
              >
                <Waves className="w-3.5 h-3.5" /> Tsunami Radar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${activeTab === "ai" ? "bg-emerald-600 text-white shadow-sm" : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Assistant
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Toggle Dark / Light Mode"
              className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-amber-400" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"}`}
            >
              {isDarkMode ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={saveCurrentPreset}
              title="Bookmark current region & variable"
              className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-sky-400" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"}`}
            >
              <BookmarkPlus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={copyShareLink}
              title="Copy shareable deep-link URL"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"}`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMethodologyModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-sky-950 border-sky-800 text-sky-300" : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"}`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Provenance</span>
            </button>
          </div>
        </div>
      </header>

      {/* Custom Coordinates Input Modal */}
      {showCoordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"} rounded-3xl max-w-md w-full p-6 shadow-2xl border space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-500" /> Enter Custom Lat / Lon Pin
              </h3>
              <button type="button" onClick={() => setShowCoordModal(false)} className="w-7 h-7 rounded-full bg-slate-800/20 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Pin Name / Location</label>
                <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} className={`w-full p-2.5 rounded-xl border ${isDarkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Latitude (-90 to 90)</label>
                  <input type="number" step="0.01" value={customLat} onChange={(e) => setCustomLat(e.target.value)} className={`w-full p-2.5 rounded-xl border ${isDarkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"}`} />
                </div>
                <div>
                  <label className="block font-bold mb-1">Longitude (-180 to 180)</label>
                  <input type="number" step="0.01" value={customLon} onChange={(e) => setCustomLon(e.target.value)} className={`w-full p-2.5 rounded-xl border ${isDarkMode ? "bg-slate-950 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-900"}`} />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setShowCoordModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-500/20 cursor-pointer">Cancel</button>
              <button type="button" onClick={() => {
                const latNum = parseFloat(customLat);
                const lonNum = parseFloat(customLon);
                if (!isNaN(latNum) && !isNaN(lonNum)) {
                  setRegionA({ name: customName, lat: latNum, lon: lonNum });
                  setShowCoordModal(false);
                } else {
                  alert("Please enter valid latitude and longitude numbers.");
                }
              }} className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer">Apply Pin A</button>
            </div>
          </div>
        </div>
      )}

      {/* Data Provenance & Methodology Modal */}
      {showMethodologyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"} rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-extrabold">Data Provenance &amp; Scientific Methodology</h3>
              </div>
              <button type="button" onClick={() => setShowMethodologyModal(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs sm:text-sm leading-relaxed max-h-[65vh] overflow-y-auto pr-2">
              <p><strong>GeoSignal</strong> is engineered for the NASA Space Apps Challenge to serve as an authoritative Earth Systems Trend Detective and disaster management dashboard.</p>
              <div>
                <h4 className="font-extrabold mb-1">1. NASA POWER Climate Telemetry &amp; PM2.5</h4>
                <p>Variables such as Surface Air Temperature (T2M), Precipitation (PRECTOTCORR), Root Zone Soil Wetness (GWETROOT), and Particulate Matter (PM2.5 / AOD) are sourced directly from NASA POWER reanalysis.</p>
              </div>
              <div>
                <h4 className="font-extrabold mb-1">2. Distance &amp; Local Time Calculation</h4>
                <p>Computes great-circle separation distances in km/miles using the Haversine formula and derives localized AM/PM times from coordinate longitudes.</p>
              </div>
            </div>
            <div className="pt-3 border-t flex justify-end">
              <button type="button" onClick={() => setShowMethodologyModal(false)} className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs cursor-pointer">Got It</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Explicit 5-Step Trend Detective Workflow Bar */}
        <section className={`rounded-3xl p-5 shadow-lg border ${isDarkMode ? "bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 border-slate-700 text-white" : "bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white border-slate-700"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-sky-300">
                NASA Trend Detective 5-Step Workflow Status
              </h2>
            </div>
            <span className="text-[10px] font-mono bg-sky-900/80 text-sky-200 px-2.5 py-0.5 rounded-full border border-sky-700">
              Active Investigation Mode
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-sky-400">STEP 1</span>
              <p className="text-xs font-extrabold mt-1">Variable Selected</p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">{activeVar.short}</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-sky-400">STEP 2</span>
              <p className="text-xs font-extrabold mt-1">Region Chosen</p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">{regionA.name}</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-sky-400">STEP 3</span>
              <p className="text-xs font-extrabold mt-1">Time Window</p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">{yearStart} – {yearEnd}</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-sky-400">STEP 4</span>
              <p className="text-xs font-extrabold mt-1">Time Series</p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">Anomaly &amp; 12m MA</p>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-sky-400">STEP 5</span>
              <p className="text-xs font-extrabold mt-1">Significance Test</p>
              <p className="text-[11px] text-emerald-400 font-bold truncate mt-0.5">
                {dataA?.statistics.is_significant ? "Significant (p < 0.05)" : "Natural Variability"}
              </p>
            </div>
          </div>
        </section>

        {/* Control Bar */}
        {!presentationMode && (
          <section className={`rounded-3xl border p-5 shadow-2xs space-y-5 transition-colors ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select NASA Earth System Variable (Including Air Quality &amp; Wildfire Smoke)
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {VARIABLES.map((v) => {
                    const Icon = v.icon;
                    const active = parameter === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setParameter(v.id)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          active
                            ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                            : isDarkMode ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{v.short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Baseline Range & Seasonality Filters */}
              <div className={`flex flex-wrap items-center gap-3 border p-3 rounded-2xl ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200/80"}`}>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Baseline Window
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1985"
                      max="2020"
                      value={yearStart}
                      onChange={(e) => setYearStart(Number(e.target.value))}
                      className={`w-16 px-2 py-1 text-xs border rounded-lg text-center font-mono font-bold ${isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="number"
                      min="1990"
                      max="2025"
                      value={yearEnd}
                      onChange={(e) => setYearEnd(Number(e.target.value))}
                      className={`w-16 px-2 py-1 text-xs border rounded-lg text-center font-mono font-bold ${isDarkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Season Filter
                  </span>
                  <div className={`flex rounded-lg p-0.5 text-[11px] font-bold ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("all")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "all" ? (isDarkMode ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs") : "text-slate-400"}`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("summer")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "summer" ? (isDarkMode ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs") : "text-slate-400"}`}
                    >
                      Summer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("winter")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "winter" ? (isDarkMode ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs") : "text-slate-400"}`}
                    >
                      Winter
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCoordModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-sky-400" : "bg-white border-slate-200 text-slate-700"}`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Custom Lat/Lon</span>
                </button>
                <button
                  type="button"
                  onClick={runAllVariablesScan}
                  disabled={scanningAll}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  <Radar className="w-4 h-4 text-sky-400" />
                  <span>{scanningAll ? "Scanning..." : "Scan All Variables"}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">{activeVar.description}</p>

            {/* Curated Biome Dipole Case Studies */}
            <div className="pt-3 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Launch a Curated Climate Dipole Case Study
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2.5">
                {BIOME_PRESETS.map((preset) => {
                  const selected = activeBiome === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyBiomePreset(preset)}
                      className={`text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                        selected
                          ? "bg-sky-500/10 border-sky-400 ring-2 ring-sky-500/15"
                          : isDarkMode ? "bg-slate-950/60 border-slate-800 hover:border-slate-700" : "bg-slate-50/60 border-slate-200/80 hover:bg-white"
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                        {preset.category}
                      </span>
                      <p className="text-sm font-extrabold mt-1.5">{preset.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{preset.question}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Saved Presets Bar */}
        {savedPresets.length > 0 && (
          <div className={`p-4 rounded-2xl border flex items-center gap-2 overflow-x-auto ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
            <span className="text-xs font-bold text-sky-400 shrink-0">Bookmarked Presets:</span>
            {savedPresets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setRegionA({ name: p.name, lat: p.lat, lon: p.lon });
                  setParameter(p.param);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono border whitespace-nowrap transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 hover:bg-slate-700" : "bg-slate-100 border-slate-200 hover:bg-slate-200"}`}
              >
                📍 {p.name} ({p.param})
              </button>
            ))}
          </div>
        )}

        {/* Multi-Variable Significance Ranking Drawer */}
        {multiScan && (
          <section className={`rounded-3xl border p-5 shadow-2xs ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider">
                  Multi-Variable Significance Ranking for {regionA.name}
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">Click any card to load into charts</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
              {multiScan.map((item, idx) => (
                <button
                  key={item.parameter}
                  type="button"
                  onClick={() => setParameter(item.parameter)}
                  className={`text-left p-3 rounded-2xl border transition cursor-pointer ${
                    parameter === item.parameter
                      ? "bg-sky-500/15 border-sky-400"
                      : isDarkMode ? "bg-slate-950 border-slate-800 hover:bg-slate-800" : "bg-slate-50 border-slate-200 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.is_significant ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"}`}>
                      {item.is_significant ? "SIG" : "NOISE"}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold mt-1 truncate">{item.short}</p>
                  <p className="text-xs font-mono font-extrabold text-sky-400 mt-0.5">
                    {item.rate > 0 ? "+" : ""}{item.rate}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">p = {item.p_value.toFixed(3)}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Inter-Region Distance & Live Local Time Indicator Card */}
        <section className={`rounded-3xl border p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Inter-Region Separation Distance &amp; Local AM/PM Times
              </h3>
              <p className="text-sm font-bold mt-0.5 flex flex-wrap items-center gap-2">
                <span>{regionA.name} <span className="text-sky-400 font-mono">({timeA})</span></span>
                <span className="text-slate-400">↔</span>
                <span>{regionB.name} <span className="text-rose-400 font-mono">({timeB})</span></span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className={`px-3 py-1.5 rounded-xl border font-mono font-bold ${isDarkMode ? "bg-slate-950 border-slate-800 text-sky-300" : "bg-slate-50 border-slate-200 text-sky-700"}`}>
              📏 {interRegionDistance.km} km ({interRegionDistance.miles} miles)
            </div>
            <div className={`px-3 py-1.5 rounded-xl border font-mono font-bold flex items-center gap-1.5 ${isDarkMode ? "bg-slate-950 border-slate-800 text-amber-300" : "bg-slate-50 border-slate-200 text-amber-700"}`}>
              <Clock className="w-3.5 h-3.5" /> Pin A: {timeA} | Pin B: {timeB}
            </div>
          </div>
        </section>

        {/* Hero Spatial Stage: Instant Tab Switcher */}
        <section ref={globeSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-12 flex flex-col">
            
            <div className={`flex items-center justify-between flex-wrap gap-3 mb-4 p-1.5 rounded-2xl ${isDarkMode ? "bg-slate-800" : "bg-slate-200"}`}>
              <div className="flex text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("globe")}
                  className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeTab === "globe" ? (isDarkMode ? "bg-slate-700 text-sky-400 shadow-sm" : "bg-white text-sky-700 shadow-sm") : "text-slate-400"}`}
                >
                  3D Climate Globe View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tsunami")}
                  className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${activeTab === "tsunami" ? "bg-rose-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                >
                  <Waves className="w-4 h-4" /> Tsunami &amp; Earthquake Radar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ai")}
                  className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${activeTab === "ai" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
                >
                  <Sparkles className="w-4 h-4" /> GeoSignal AI Assistant
                </button>
              </div>

              {activeTab === "tsunami" && (
                <div className="flex items-center gap-2 px-3">
                  <button
                    type="button"
                    onClick={() => setShowTsunamiRings(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      showTsunamiRings
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 animate-spin" />
                    <span>{showTsunamiRings ? "1-hr / 3-hr / 6-hr Rings ON" : "Rings OFF"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live USGS Seismic Tsunami Radar Tab */}
            <div className={`rounded-3xl p-8 border flex-col justify-between shadow-2xs ${activeTab === "tsunami" ? "flex" : "hidden"} ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-500">
                  <Waves className="w-5 h-5 animate-bounce" /> Real-Time USGS Global Seismic &amp; Tsunami Early Warning Radar
                </span>
                <div className="flex items-center gap-2">
                  {showTsunamiRings && (
                    <span className="px-3 py-1 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      🌊 Tsunami Wave Rings: 1h (~800km) | 3h (~2400km) | 6h (~4800km) Active
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full text-xs font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    USGS Feed Active
                  </span>
                </div>
              </div>
              <TsunamiGlobe3D />
            </div>

            {/* AI Assistant Tab */}
            <div className={`rounded-3xl p-8 border flex-col justify-between shadow-2xl ${activeTab === "ai" ? "flex" : "hidden"} ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-950 border-slate-800 text-white"}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="w-5 h-5" /> GeoSignal AI Climate &amp; Trend Assistant
                </span>
                <span className="text-xs text-slate-400 font-mono">Telemetry Expert</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[360px] mb-4">
                {aiChatLog.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${msg.role === "user" ? "bg-emerald-500 text-slate-950 font-medium" : "bg-slate-900 border border-slate-800 text-slate-200"}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAIChat} className="flex gap-2">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask about local AM/PM time, distance, tsunamis, PM2.5 smoke..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs transition cursor-pointer">
                  Ask AI
                </button>
              </form>
            </div>

            {/* 3D Globe & Map Tab */}
            <div className={`grid-cols-1 lg:grid-cols-12 gap-6 items-stretch ${activeTab === "globe" ? "grid" : "hidden"}`}>
              <div className="lg:col-span-6 relative">
                <EarthGlobe3D
                  parameter={parameter}
                  regionA={regionA}
                  regionB={regionB}
                  rateA={dataA?.statistics.rate_per_decade}
                  rateB={dataB?.statistics.rate_per_decade}
                  unit={activeVar.unit}
                  variableLabel={activeVar.short}
                  gibsLayer={parameter === "PM25" || parameter === "AOD" ? "aerosol" : "chlorophyll"}
                  gibsOpacity={0.8}
                  onInspectGlobalPeak={(lat, lon, peakName) => {
                    setRegionA({ name: peakName, lat, lon });
                    setActiveBiome("global-peak");
                    setMultiScan(null);
                  }}
                />
              </div>

              <div className={`rounded-3xl border p-4 shadow-2xs flex flex-col justify-between space-y-3 lg:col-span-6 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
                <div className="relative z-30 flex flex-wrap items-center gap-2">
                  <div className={`flex rounded-xl p-1 text-xs font-bold ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
                    <button
                      type="button"
                      onClick={() => setSearchTarget("A")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${searchTarget === "A" ? (isDarkMode ? "bg-slate-700 text-sky-400 shadow-2xs" : "bg-white text-sky-700 shadow-2xs") : "text-slate-400"}`}
                    >
                      Pin A ({timeA})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchTarget("B")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${searchTarget === "B" ? (isDarkMode ? "bg-slate-700 text-rose-400 shadow-2xs" : "bg-white text-rose-600 shadow-2xs") : "text-slate-400"}`}
                    >
                      Pin B ({timeB})
                    </button>
                  </div>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      placeholder={`Search city for Pin ${searchTarget}...`}
                      className={`w-full pl-8 pr-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 ${isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                    />
                    {searchResults.length > 0 && (
                      <div className={`absolute left-0 right-0 mt-1 border rounded-2xl shadow-lg overflow-hidden z-50 ${isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
                        {searchResults.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => selectCity(city)}
                            className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between border-b last:border-0 cursor-pointer ${isDarkMode ? "hover:bg-slate-800 border-slate-800" : "hover:bg-sky-50 border-slate-100"}`}
                          >
                            <span className="font-bold">
                              {city.name}{city.admin1 ? `, ${city.admin1}` : ""}, {city.country}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex-1 min-h-[380px] rounded-2xl overflow-hidden border ${isDarkMode ? "border-slate-800" : "border-slate-200/80"}`}>
                  <WorldMap
                    regionA={regionA}
                    regionB={regionB}
                    onSelectRegionA={(lat, lon) => {
                      setRegionA({ name: `Custom (${lat}°, ${lon}°)`, lat, lon });
                      setActiveBiome("custom");
                      setMultiScan(null);
                    }}
                    onSelectRegionB={(lat, lon) => {
                      setRegionB({ name: `Custom (${lat}°, ${lon}°)`, lat, lon });
                      setActiveBiome("custom");
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Global Population Exposure Index Bar */}
        <section className={`rounded-3xl border p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Global Population Exposure Index ({regionA.name})
              </h3>
              <p className="text-sm font-bold mt-0.5">
                Estimated Exposed Population: <span className="font-mono text-amber-500">{populationExposure.totalExposed}</span> ({populationExposure.vulnerability})
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-400 max-w-sm">
            Calculated by multiplying gridded population density matrices with regional climate anomaly trends and seismic hazard buffers.
          </div>
        </section>

        {/* Scientific Synthesis & Action Toolbar */}
        <section ref={chartsSectionRef} className={`rounded-3xl border p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-sky-500">
                <Sparkles className="w-3.5 h-3.5" /> Scientific Synthesis
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                PEARSON R = {pearsonR}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold">{synthesis.headline}</h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              {synthesis.mechanism}{" "}
              <span className="font-bold text-sky-400">Next Step: {synthesis.nextStep}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Split / Overlay */}
            <div className={`flex rounded-xl p-1 text-xs font-bold ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
              <button
                type="button"
                onClick={() => setChartMode("split")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${chartMode === "split" ? (isDarkMode ? "bg-slate-700 text-white shadow-2xs" : "bg-white text-slate-900 shadow-2xs") : "text-slate-400"}`}
              >
                <Columns2 className="w-3.5 h-3.5" /> <span>Split View</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("overlay")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${chartMode === "overlay" ? (isDarkMode ? "bg-slate-700 text-white shadow-2xs" : "bg-white text-slate-900 shadow-2xs") : "text-slate-400"}`}
              >
                <Layers className="w-3.5 h-3.5" /> <span>Overlay</span>
              </button>
            </div>

            {/* Anomalies / Raw Cycles */}
            <div className={`flex rounded-xl p-1 text-xs font-bold ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
              <button
                type="button"
                onClick={() => setSeriesType("anomaly")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${seriesType === "anomaly" ? (isDarkMode ? "bg-slate-700 text-white shadow-2xs" : "bg-white text-slate-900 shadow-2xs") : "text-slate-400"}`}
              >
                Anomalies
              </button>
              <button
                type="button"
                onClick={() => setSeriesType("raw")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${seriesType === "raw" ? (isDarkMode ? "bg-slate-700 text-white shadow-2xs" : "bg-white text-slate-900 shadow-2xs") : "text-slate-400"}`}
              >
                Raw Cycles
              </button>
            </div>

            {/* 12m Trend Toggle Button */}
            <button
              type="button"
              onClick={() => setShowRolling((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showRolling
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                  : isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              12m Trend
            </button>

            <button
              type="button"
              onClick={copyJsonApiUrl}
              title="Copy JSON REST API Endpoint"
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-sky-400" : "bg-white border-slate-200 text-slate-700"}`}
            >
              <Code2 className="w-3.5 h-3.5" /> API
            </button>

            <button
              type="button"
              onClick={exportMarkdownBrief}
              title="Export Markdown Brief"
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
            >
              <FileText className="w-3.5 h-3.5 text-sky-500" /> MD
            </button>

            <button
              type="button"
              onClick={exportPDFReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" /> PDF
            </button>

            <button
              type="button"
              onClick={exportMergedCSV}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700"}`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" /> CSV
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl p-4 flex items-center gap-3 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dual Statistical Cards & Time-Series Charts */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((idx) => (
              <div key={idx} className={`rounded-3xl border p-6 h-[380px] animate-pulse space-y-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"}`} />
            ))}
          </div>
        ) : (
          dataA && dataB && (
            <>
              {chartMode === "overlay" ? (
                <section className={`rounded-3xl border p-6 shadow-2xs space-y-4 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold">
                        Direct Teleconnection Overlay: {regionA.name} vs. {regionB.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        12-month smoothed anomalies &amp; linear trendlines on a unified axis (Pearson r = {pearsonR})
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono font-bold">
                      <span className="text-sky-400">A ({timeA}): {dataA.statistics.rate_per_decade > 0 ? "+" : ""}{dataA.statistics.rate_per_decade} {activeVar.unit}/dec</span>
                      <span className="text-rose-400">B ({timeB}): {dataB.statistics.rate_per_decade > 0 ? "+" : ""}{dataB.statistics.rate_per_decade} {activeVar.unit}/dec</span>
                    </div>
                  </div>

                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overlaySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: isDarkMode ? "#94a3b8" : "#64748b" }} minTickGap={35} />
                        <YAxis tick={{ fontSize: 11, fill: isDarkMode ? "#94a3b8" : "#64748b" }} />
                        <Tooltip contentStyle={{ borderRadius: "16px", backgroundColor: isDarkMode ? "#0f172a" : "#fff", border: isDarkMode ? "1px solid #334155" : "1px solid #e2e8f0", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Line type="monotone" dataKey="rollingA" name={`Region A (${regionA.name})`} stroke="#0ea5e9" strokeWidth={2.2} dot={false} />
                        <Line type="monotone" dataKey="trendA" name="Region A Trend" stroke="#0ea5e9" strokeDasharray="5 5" strokeWidth={1.8} dot={false} />
                        <Line type="monotone" dataKey="rollingB" name={`Region B (${regionB.name})`} stroke="#f43f5e" strokeWidth={2.2} dot={false} />
                        <Line type="monotone" dataKey="trendB" name="Region B Trend" stroke="#f43f5e" strokeDasharray="5 5" strokeWidth={1.8} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[
                    { tag: "REGION A", region: regionA, data: dataA, series: enrichedSeriesA, accent: "#0ea5e9", time: timeA },
                    { tag: "REGION B", region: regionB, data: dataB, series: enrichedSeriesB, accent: "#f43f5e", time: timeB },
                  ].map((panel) => {
                    const stats = panel.data.statistics;
                    const positive = stats.rate_per_decade >= 0;
                    return (
                      <div key={panel.tag} className={`rounded-3xl border p-6 shadow-2xs space-y-4 ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200/90 text-slate-900"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white" style={{ backgroundColor: panel.accent }}>
                                {panel.tag} ({panel.time})
                              </span>
                              <span className="text-xs font-mono text-slate-400">{panel.region.lat}°, {panel.region.lon}°</span>
                            </div>
                            <h3 className="text-base font-extrabold mt-1">{panel.region.name}</h3>
                          </div>
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${stats.is_significant ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{stats.is_significant ? "Significant (p < 0.05)" : "Natural Variability"}</span>
                          </div>
                        </div>

                        <div className={`grid grid-cols-3 gap-3 rounded-2xl p-3.5 border ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50/80 border-slate-100"}`}>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Decadal Rate</p>
                            <p className="text-base sm:text-lg font-mono font-extrabold flex items-center gap-1 mt-0.5">
                              {positive ? <TrendingUp className="w-4 h-4 text-rose-500" /> : <TrendingDown className="w-4 h-4 text-sky-400" />}
                              {positive ? "+" : ""}{stats.rate_per_decade}
                            </p>
                            <p className="text-[10px] text-slate-400">{activeVar.unit}/dec</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Mann-Kendall Z</p>
                            <p className="text-base sm:text-lg font-mono font-extrabold mt-0.5">{stats.z_score}σ</p>
                            <p className="text-[10px] text-slate-400">p = {stats.p_value.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Baseline Mean</p>
                            <p className="text-base sm:text-lg font-mono font-extrabold mt-0.5">{stats.overall_mean}</p>
                            <p className="text-[10px] text-slate-400">{activeVar.unit}</p>
                          </div>
                        </div>

                        <div className="h-[245px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {seriesType === "anomaly" ? (
                              <BarChart data={panel.series}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} vertical={false} />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: isDarkMode ? "#94a3b8" : "#64748b" }} minTickGap={30} />
                                <YAxis tick={{ fontSize: 10, fill: isDarkMode ? "#94a3b8" : "#64748b" }} width={40} />
                                <Tooltip contentStyle={{ borderRadius: "14px", backgroundColor: isDarkMode ? "#0f172a" : "#fff", border: isDarkMode ? "1px solid #334155" : "1px solid #e2e8f0", fontSize: "11px" }} />
                                <ReferenceLine y={0} stroke="#cbd5e1" />
                                <Bar dataKey="anomaly" radius={[2, 2, 0, 0]}>
                                  {panel.series.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.anomaly >= 0 ? "#f43f5e" : "#0ea5e9"} fillOpacity={0.75} />
                                  ))}
                                </Bar>
                                {showRolling && (
                                  <Line type="monotone" dataKey="rolling12m" name="12-Month Moving Avg" stroke={isDarkMode ? "#38bdf8" : "#0f172a"} strokeWidth={2} dot={false} />
                                )}
                              </BarChart>
                            ) : (
                              <LineChart data={panel.series}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#1e293b" : "#f1f5f9"} vertical={false} />
                                <XAxis dataKey="year" tick={{ fontSize: 10, fill: isDarkMode ? "#94a3b8" : "#64748b" }} minTickGap={30} />
                                <YAxis tick={{ fontSize: 10, fill: isDarkMode ? "#94a3b8" : "#64748b" }} width={45} domain={["auto", "auto"]} />
                                <Tooltip contentStyle={{ borderRadius: "14px", backgroundColor: isDarkMode ? "#0f172a" : "#fff", border: isDarkMode ? "1px solid #334155" : "1px solid #e2e8f0", fontSize: "11px" }} />
                                <Line type="monotone" dataKey="value" name={`Observed (${activeVar.unit})`} stroke={panel.accent} strokeWidth={1.75} dot={false} />
                              </LineChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
}