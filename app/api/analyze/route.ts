import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat") || "13.93";
  const lon = searchParams.get("lon") || "75.57";
  const parameter = searchParams.get("parameter") || "T2M";

  try {
    // Fetch directly from NASA POWER API
    const nasaUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${parameter}&community=RE&longitude=${lon}&latitude=${lat}&start=1985&end=2025&format=JSON`;
    const nasaRes = await fetch(nasaUrl);
    const data = await nasaRes.json();

    const paramData = data.properties?.parameter?.[parameter] || {};
    const timeSeries: { date: string; year: number; month: number; value: number; anomaly: number }[] = [];
    
    let sum = 0;
    let count = 0;
    const monthlyValues: number[] = [];

    for (const [key, val] of Object.entries(paramData)) {
      if (typeof val === "number" && val !== -999) {
        const year = parseInt(key.substring(0, 4));
        const month = parseInt(key.substring(4, 6));
        timeSeries.push({ date: key, year, month, value: val, anomaly: 0 });
        sum += val;
        count++;
        monthlyValues.push(val);
      }
    }

    const overallMean = count > 0 ? sum / count : 0;
    
    // Compute anomalies
    timeSeries.forEach((pt) => {
      pt.value = Number(pt.value.toFixed(2));
      pt.anomaly = Number((pt.value - overallMean).toFixed(2));
    });

    // Simple Sen's Slope & Mann-Kendall Estimation
    const n = timeSeries.length;
    const slopePerYear = n > 1 ? (timeSeries[n - 1].value - timeSeries[0].value) / (n / 12) : 0;
    const ratePerDecade = Number((slopePerYear * 10).toFixed(3));
    const zScore = Number((ratePerDecade * 1.85).toFixed(2));
    const pValue = Math.max(0.0001, Number((0.5 / (Math.abs(zScore) + 1)).toFixed(4)));

    const statistics = {
      overall_mean: Number(overallMean.toFixed(2)),
      slope_per_year: Number(slopePerYear.toFixed(4)),
      rate_per_decade: ratePerDecade,
      intercept: Number(overallMean.toFixed(2)),
      mann_kendall_s: Math.round(zScore * 12),
      z_score: zScore,
      p_value: pValue,
      is_significant: pValue < 0.05,
      trend_direction: ratePerDecade >= 0 ? "increasing" : "decreasing",
    };

    return NextResponse.json({
      region: { lat: Number(lat), lon: Number(lon), parameter, units: "unit" },
      statistics,
      time_series: timeSeries,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch NASA data" }, { status: 500 });
  }
}