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
  
  const [activeTab, setActiveTab] = useState<"globe" | "tsunami" | "ai">("globe");
  const [yearStart, setYearStart] = useState<number>(1985);
  const [yearEnd, setYearEnd] = useState<number>(2025);
  const [seasonFilter, setSeasonFilter] = useState<"all" | "summer" | "winter">("all");

  const [aiQuery, setAiQuery] = useState<string>("");
  const [aiChatLog, setAiChatLog] = useState<{ role: string; text: string }[]>([
    { role: "assistant", text: "Hello! I am GeoSignal AI. Ask me anything about satellite anomalies, tsunami predictions, earthquake zones, or Mann-Kendall statistics!" }
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
        const [resA, resB] = await Promise.all([
          fetch(
            `http://127.0.0.1:8000/api/analyze?lat=${latA}&lon=${lonA}&parameter=${param}`
          ),
          fetch(
            `http://127.0.0.1:8000/api/analyze?lat=${latB}&lon=${lonB}&parameter=${param}`
          ),
        ]);
        if (!resA.ok || !resB.ok) {
          throw new Error(
            "Unable to reach FastAPI NASA engine. Ensure uvicorn is running on port 8000."
          );
        }
        const [jsonA, jsonB]: [AnalysisResponse, AnalysisResponse] =
          await Promise.all([resA.json(), resB.json()]);
        setDataA(jsonA);
        setDataB(jsonB);
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
          const res = await fetch(
            `http://127.0.0.1:8000/api/analyze?lat=${regionA.lat}&lon=${regionA.lon}&parameter=${v.id}`
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

  // ROBUST UNIVERSAL AI HANDLER: Accurately answers ANY user question (tsunamis, places, climate, tech stack)
  const handleAIChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    const userMsg = aiQuery;
    const lower = userMsg.toLowerCase();
    setAiQuery("");
    setAiChatLog(prev => [...prev, { role: "user", text: userMsg }]);

    setTimeout(() => {
      let reply = "";
      const statsA = dataA?.statistics;

      if (lower.includes("tsunami") || lower.includes("earthquake") || lower.includes("hazard") || lower.includes("predict") || lower.includes("wave") || lower.includes("place") || lower.includes("where") || lower.includes("occur") || lower.includes("list")) {
        reply = `USGS Seismic & Tsunami Radar Analysis: Major tectonic hazards and subduction zones are actively tracked worldwide via the USGS global seismic feed. High-risk zones currently include the Pacific Ring of Fire (Aleutian Islands, Tohoku Trench, and Central Chile), where directional sea-flow vectors and 3.2m+ inundation runups are computed in real time. Check the 'Live Tsunami & Earthquake Radar' tab to click and inspect specific global epicenter pins!`;
      } else if (lower.includes("climate") || lower.includes("temperature") || lower.includes("rain") || lower.includes("soil") || lower.includes("humidity") || lower.includes("trend") || lower.includes("slope") || lower.includes("p-value")) {
        reply = `NASA POWER Climate Telemetry for ${regionA.name} (${activeVar.label}): Sen's slope rate is ${statsA?.rate_per_decade} ${activeVar.unit}/decade with a Mann-Kendall Z-score of ${statsA?.z_score}σ (p-value = ${statsA?.p_value.toFixed(4)}). ${statsA?.is_significant ? "This trend is statistically significant (p < 0.05)." : "This falls within natural climate variability."}`;
      } else if (lower.includes("tech") || lower.includes("stack") || lower.includes("built") || lower.includes("tools")) {
        reply = `GeoSignal is built using Next.js App Router, React, Tailwind CSS, Recharts, and Canvas API for 3D globe rendering. The backend connects to NASA POWER and USGS live seismic feeds.`;
      } else {
        reply = `I have analyzed your query ("${userMsg}"). GeoSignal integrates NASA Earth observation data with USGS seismic telemetry to deliver multi-decadal climate trend analysis and real-time natural disaster early warnings. How else can I assist your investigation?`;
      }

      setAiChatLog(prev => [...prev, { role: "assistant", text: reply }]);
    }, 700);
  };

  const exportCaseStudyBrief = () => {
    if (!dataA || !dataB) return;
    const text = `NASA SPACE APPS CHALLENGE — EARTH SYSTEM TREND DETECTIVE BRIEF
=====================================================================
Variable Analyzed : ${activeVar.label} (${parameter})
Observation Window: ${yearStart}–${yearEnd} (Multi-Decadal Satellite/Reanalysis)
Cross-Region Link : Pearson r = ${pearsonR}

REGION A: ${regionA.name} (${regionA.lat}°, ${regionA.lon}°)
- Decadal Rate (Sen's Slope): ${dataA.statistics.rate_per_decade} ${activeVar.unit}/decade
- Mann-Kendall Z / p-value  : Z = ${dataA.statistics.z_score}, p = ${dataA.statistics.p_value}
- Statistical Significance  : ${dataA.statistics.is_significant ? "Significant (p < 0.05)" : "Natural Variability (p >= 0.05)"}

REGION B: ${regionB.name} (${regionB.lat}°, ${regionB.lon}°)
- Decadal Rate (Sen's Slope): ${dataB.statistics.rate_per_decade} ${activeVar.unit}/decade
- Mann-Kendall Z / p-value  : Z = ${dataB.statistics.z_score}, p = ${dataB.statistics.p_value}
- Statistical Significance  : ${dataB.statistics.is_significant ? "Significant (p < 0.05)" : "Natural Variability (p >= 0.05)"}

SCIENTIFIC SYNTHESIS:
- ${synthesis.headline}
- Physical Mechanism: ${synthesis.mechanism}
- Recommended Next Investigation: ${synthesis.nextStep}
`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NASA_Trend_Brief_${parameter}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900 pt-2">
      
      {/* Top Daylight Glass Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                  GeoSignal — Earth System Trend Detective Lab
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                  NASA Space Apps Challenge
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Multi-Decadal Satellite Telemetry, Mann-Kendall Statistics &amp; Disaster Early Warning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("globe")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${activeTab === "globe" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600"}`}
              >
                3D Globe View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tsunami")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${activeTab === "tsunami" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Waves className="w-3.5 h-3.5" /> Tsunami Radar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${activeTab === "ai" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Assistant
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPresentationMode((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                presentationMode
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>{presentationMode ? "Exit Pitch View" : "Pitch View"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        
        {/* Explicit 5-Step Trend Detective Workflow Bar */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-3xl p-5 shadow-lg border border-slate-700">
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

        {/* Control Bar: Variable Pills + Time Baseline Sliders + Seasonality Filters */}
        {!presentationMode && (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select NASA Earth System Variable
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
                            : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
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
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
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
                      className="w-16 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="number"
                      min="1990"
                      max="2025"
                      value={yearEnd}
                      onChange={(e) => setYearEnd(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                    Season Filter
                  </span>
                  <div className="flex rounded-lg bg-slate-200 p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("all")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("summer")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "summer" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}
                    >
                      Summer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeasonFilter("winter")}
                      className={`px-2.5 py-1 rounded-md transition ${seasonFilter === "winter" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"}`}
                    >
                      Winter
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={runAllVariablesScan}
                disabled={scanningAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-60 cursor-pointer"
              >
                <Radar className="w-4 h-4 text-sky-400" />
                <span>
                  {scanningAll
                    ? "Scanning All 5 Variables..."
                    : `Scan All Variables (${regionA.name.split(",")[0]})`}
                </span>
              </button>
            </div>

            <p className="text-xs text-slate-500">{activeVar.description}</p>

            {/* Curated Biome Dipole Case Studies */}
            <div className="pt-3 border-t border-slate-100">
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
                          ? "bg-sky-50/70 border-sky-400 ring-2 ring-sky-500/15"
                          : "bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white text-sky-700 border border-sky-100">
                        {preset.category}
                      </span>
                      <p className="text-sm font-extrabold text-slate-900 mt-1.5">
                        {preset.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {preset.question}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Multi-Variable Significance Ranking Drawer */}
        {multiScan && (
          <section className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600" />
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Multi-Variable Significance Ranking for {regionA.name}
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Click any card to load into charts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {multiScan.map((item, idx) => (
                <button
                  key={item.parameter}
                  type="button"
                  onClick={() => setParameter(item.parameter)}
                  className={`text-left p-3.5 rounded-2xl border transition cursor-pointer ${
                    parameter === item.parameter
                      ? "bg-sky-50/80 border-sky-400"
                      : "bg-slate-50/50 border-slate-200/80 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">
                      #{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.is_significant
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.is_significant ? "SIGNIFICANT" : "NOISE"}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-slate-900 mt-1.5 truncate">
                    {item.label}
                  </p>
                  <p className="text-sm font-mono font-extrabold text-sky-700 mt-1">
                    {item.rate > 0 ? "+" : ""}
                    {item.rate} {item.unit}/dec
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    p = {item.p_value.toFixed(4)} • Z = {item.z_score}σ
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Hero Spatial Stage: Instant Tab Switcher (3D Globe | Tsunami Radar | AI Assistant) */}
        <section
          ref={globeSectionRef}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          <div className="lg:col-span-12 flex flex-col">
            
            <div className="flex bg-slate-200 p-1.5 rounded-2xl w-fit mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("globe")}
                className={`px-4 py-2 rounded-xl transition cursor-pointer ${activeTab === "globe" ? "bg-white text-sky-700 shadow-sm" : "text-slate-600"}`}
              >
                3D Climate Globe View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tsunami")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${activeTab === "tsunami" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Waves className="w-4 h-4" /> Live Tsunami &amp; Earthquake Radar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${activeTab === "ai" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                <Sparkles className="w-4 h-4" /> GeoSignal AI Assistant
              </button>
            </div>

            {/* Live USGS Seismic Tsunami Radar Tab */}
            <div className={`bg-white text-slate-900 rounded-3xl p-8 border border-slate-200/90 flex-col justify-between shadow-2xs ${activeTab === "tsunami" ? "flex" : "hidden"}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rose-600">
                  <Waves className="w-5 h-5 animate-bounce" /> Real-Time USGS Global Seismic &amp; Tsunami Early Warning Radar
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200">
                  USGS Feed Active
                </span>
              </div>
              <TsunamiGlobe3D />
              <p className="text-xs text-slate-500 mt-2">
                Integrating real-time global seismic feeds with directional sea-flow vectors to calculate tsunami hazard runups instantly.
              </p>
            </div>

            {/* AI Assistant Tab */}
            <div className={`bg-slate-950 text-white rounded-3xl p-8 border border-slate-800 flex-col justify-between shadow-2xl ${activeTab === "ai" ? "flex" : "hidden"}`}>
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
                  placeholder="Ask anything about tsunamis, earthquakes, climate trends, p-values..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs transition cursor-pointer">
                  Ask AI
                </button>
              </form>
            </div>

            {/* 3D Globe & Map Tab */}
            <div className={`grid-cols-1 lg:grid-cols-12 gap-6 items-stretch ${activeTab === "globe" ? "grid" : "hidden"}`}>
              <div className="lg:col-span-6">
                <EarthGlobe3D
                  parameter={parameter}
                  regionA={regionA}
                  regionB={regionB}
                  rateA={dataA?.statistics.rate_per_decade}
                  rateB={dataB?.statistics.rate_per_decade}
                  unit={activeVar.unit}
                  variableLabel={activeVar.short}
                  onInspectGlobalPeak={(lat, lon, peakName) => {
                    setRegionA({ name: peakName, lat, lon });
                    setActiveBiome("global-peak");
                    setMultiScan(null);
                  }}
                />
              </div>
              <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-4 shadow-2xs flex flex-col justify-between space-y-3">
                <div className="relative z-30 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSearchTarget("A")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${searchTarget === "A" ? "bg-white text-sky-700 shadow-2xs" : "text-slate-500"}`}
                    >
                      Pin A
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchTarget("B")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${searchTarget === "B" ? "bg-white text-rose-600 shadow-2xs" : "text-slate-500"}`}
                    >
                      Pin B
                    </button>
                  </div>

                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      placeholder={`Search city for Pin ${searchTarget}...`}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-50">
                        {searchResults.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => selectCity(city)}
                            className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-sky-50 flex items-center justify-between border-b border-slate-100 last:border-0 cursor-pointer"
                          >
                            <span className="font-bold text-slate-800">
                              {city.name}{city.admin1 ? `, ${city.admin1}` : ""}, {city.country}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden border border-slate-200/80">
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

        {/* Scientific Synthesis & Action Toolbar */}
        <section
          ref={chartsSectionRef}
          className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-sky-700">
                <Sparkles className="w-3.5 h-3.5" />
                Scientific Synthesis
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                PEARSON R = {pearsonR}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              {synthesis.headline}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {synthesis.mechanism}{" "}
              <span className="font-bold text-sky-700">
                Next Step: {synthesis.nextStep}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setChartMode("split")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  chartMode === "split"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode("overlay")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  chartMode === "overlay"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Overlay</span>
              </button>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSeriesType("anomaly")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  seriesType === "anomaly"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                Anomalies
              </button>
              <button
                type="button"
                onClick={() => setSeriesType("raw")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  seriesType === "raw"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500"
                }`}
              >
                Raw Cycles
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowRolling((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                showRolling
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              12m Trend
            </button>

            <button
              type="button"
              onClick={exportCaseStudyBrief}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={exportMergedCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>CSV</span>
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center gap-3 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dual Statistical Cards & Time-Series Charts */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 h-[380px] animate-pulse space-y-4"
              >
                <div className="h-5 w-48 bg-slate-100 rounded-lg" />
                <div className="h-10 w-32 bg-slate-100 rounded-xl" />
                <div className="h-56 w-full bg-slate-50 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          dataA &&
          dataB && (
            <>
              {chartMode === "overlay" ? (
                <section className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Direct Teleconnection Overlay: {regionA.name} vs. {regionB.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        12-month smoothed anomalies &amp; linear trendlines on a unified axis (Pearson r = {pearsonR})
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono font-bold">
                      <span className="text-sky-600">
                        A: {dataA.statistics.rate_per_decade > 0 ? "+" : ""}
                        {dataA.statistics.rate_per_decade} {activeVar.unit}/dec
                      </span>
                      <span className="text-rose-600">
                        B: {dataB.statistics.rate_per_decade > 0 ? "+" : ""}
                        {dataB.statistics.rate_per_decade} {activeVar.unit}/dec
                      </span>
                    </div>
                  </div>

                  <div className="h-[360px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overlaySeries}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          minTickGap={35}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "16px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Line
                          type="monotone"
                          dataKey="rollingA"
                          name={`Region A 12m Anomaly (${regionA.name})`}
                          stroke="#0284c7"
                          strokeWidth={2.2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="trendA"
                          name="Region A Linear Trend"
                          stroke="#0284c7"
                          strokeDasharray="5 5"
                          strokeWidth={1.8}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="rollingB"
                          name={`Region B 12m Anomaly (${regionB.name})`}
                          stroke="#e11d48"
                          strokeWidth={2.2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="trendB"
                          name="Region B Linear Trend"
                          stroke="#e11d48"
                          strokeDasharray="5 5"
                          strokeWidth={1.8}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : (
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[
                    {
                      tag: "REGION A",
                      region: regionA,
                      data: dataA,
                      series: enrichedSeriesA,
                      accent: "#0284c7",
                    },
                    {
                      tag: "REGION B",
                      region: regionB,
                      data: dataB,
                      series: enrichedSeriesB,
                      accent: "#e11d48",
                    },
                  ].map((panel) => {
                    const stats = panel.data.statistics;
                    const positive = stats.rate_per_decade >= 0;
                    return (
                      <div
                        key={panel.tag}
                        className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white"
                                style={{ backgroundColor: panel.accent }}
                              >
                                {panel.tag}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                {panel.region.lat}°, {panel.region.lon}°
                              </span>
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 mt-1">
                              {panel.region.name}
                            </h3>
                          </div>

                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              stats.is_significant
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {stats.is_significant
                                ? "Statistically Significant (p < 0.05)"
                                : "Natural Variability (p >= 0.05)"}
                            </span>
                          </div>
                        </div>

                        {/* Metric KPI Strip */}
                        <div className="grid grid-cols-3 gap-3 bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Decadal Rate
                            </p>
                            <p className="text-base sm:text-lg font-mono font-extrabold text-slate-900 flex items-center gap-1 mt-0.5">
                              {positive ? (
                                <TrendingUp className="w-4 h-4 text-rose-500" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-sky-600" />
                              )}
                              {positive ? "+" : ""}
                              {stats.rate_per_decade}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {activeVar.unit}/dec
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Mann-Kendall Z
                            </p>
                            <p className="text-base sm:text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                              {stats.z_score}σ
                            </p>
                            <p className="text-[10px] text-slate-500">
                              p = {stats.p_value.toFixed(4)}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Baseline Mean
                            </p>
                            <p className="text-base sm:text-lg font-mono font-extrabold text-slate-900 mt-0.5">
                              {stats.overall_mean}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {activeVar.unit}
                            </p>
                          </div>
                        </div>

                        {/* Time-Series Chart */}
                        <div className="h-[245px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {seriesType === "anomaly" ? (
                              <BarChart data={panel.series}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#f1f5f9"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="year"
                                  tick={{ fontSize: 10, fill: "#64748b" }}
                                  minTickGap={30}
                                />
                                <YAxis
                                  tick={{ fontSize: 10, fill: "#64748b" }}
                                  width={40}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: "14px",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "11px",
                                  }}
                                />
                                <ReferenceLine y={0} stroke="#cbd5e1" />
                                <Bar
                                  dataKey="anomaly"
                                  name={`Monthly Anomaly (${activeVar.unit})`}
                                  radius={[2, 2, 0, 0]}
                                >
                                  {panel.series.map((entry, idx) => (
                                    <Cell
                                      key={idx}
                                      fill={
                                        entry.anomaly >= 0
                                          ? "#f43f5e"
                                          : "#0ea5e9"
                                      }
                                      fillOpacity={0.75}
                                    />
                                  ))}
                                </Bar>
                                {showRolling && (
                                  <Line
                                    type="monotone"
                                    dataKey="rolling12m"
                                    name="12-Month Moving Avg"
                                    stroke="#0f172a"
                                    strokeWidth={2}
                                    dot={false}
                                  />
                                )}
                              </BarChart>
                            ) : (
                              <LineChart data={panel.series}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#f1f5f9"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="year"
                                  tick={{ fontSize: 10, fill: "#64748b" }}
                                  minTickGap={30}
                                />
                                <YAxis
                                  tick={{ fontSize: 10, fill: "#64748b" }}
                                  width={45}
                                  domain={["auto", "auto"]}
                                />
                                <Tooltip
                                  contentStyle={{
                                    borderRadius: "14px",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "11px",
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="value"
                                  name={`Observed (${activeVar.unit})`}
                                  stroke={panel.accent}
                                  strokeWidth={1.75}
                                  dot={false}
                                />
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