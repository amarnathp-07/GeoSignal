"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  Flame,
  Snowflake,
  Satellite,
  Compass,
  LocateFixed,
  Trophy,
  CloudRain,
  Sun,
  Wind,
} from "lucide-react";

interface EarthGlobe3DProps {
  parameter: string;
  regionA: { name: string; lat: number; lon: number };
  regionB: { name: string; lat: number; lon: number };
  rateA?: number;
  rateB?: number;
  unit: string;
  variableLabel: string;
  onInspectGlobalPeak?: (lat: number, lon: number, name: string) => void;
}

interface LiveWeatherTelemetry {
  temperature: number;
  humidity: number;
  precipitation: number;
  cloudCover: number;
  windSpeed: number;
  windDirectionDeg: number;
  solarRadiation: number;
  soilMoisture: number;
}

const GLOBAL_PEAKS: Record<
  string,
  {
    title: string;
    atmosphereColor: string;
    peak: {
      lat: number;
      lng: number;
      name: string;
      percentage: string;
      peakTelemetry: LiveWeatherTelemetry;
    };
  }
> = {
  T2M: {
    title: "Live Thermal Surface Heatmap",
    atmosphereColor: "#f97316",
    peak: {
      lat: 78.22,
      lng: 15.65,
      name: "Svalbard, Arctic Circle",
      percentage: "99.4% Peak Warming",
      peakTelemetry: {
        temperature: 34,
        humidity: 72,
        precipitation: 0,
        cloudCover: 30,
        windSpeed: 18,
        windDirectionDeg: 210,
        solarRadiation: 220,
        soilMoisture: 0.32,
      },
    },
  },
  PRECTOTCORR: {
    title: "Live Precipitation Radar & Rain Check",
    atmosphereColor: "#0284c7",
    peak: {
      lat: 25.27,
      lng: 91.73,
      name: "Meghalaya Monsoon Core, India",
      percentage: "99.1% Peak Rainfall",
      peakTelemetry: {
        temperature: 22,
        humidity: 94,
        precipitation: 4.5,
        cloudCover: 95,
        windSpeed: 24,
        windDirectionDeg: 225,
        solarRadiation: 140,
        soilMoisture: 0.48,
      },
    },
  },
  QV2M: {
    title: "Live Wind Vector & Vapor Streamlines",
    atmosphereColor: "#0ea5e9",
    peak: {
      lat: 0.5,
      lng: 114.0,
      name: "Maritime Continent (Borneo)",
      percentage: "99.3% Peak Humidity",
      peakTelemetry: {
        temperature: 29,
        humidity: 91,
        precipitation: 0.8,
        cloudCover: 65,
        windSpeed: 28,
        windDirectionDeg: 110,
        solarRadiation: 620,
        soilMoisture: 0.42,
      },
    },
  },
  GWETROOT: {
    title: "Live Root-Zone Soil Moisture Map",
    atmosphereColor: "#10b981",
    peak: {
      lat: -3.11,
      lng: -60.02,
      name: "Amazon Rainforest Basin",
      percentage: "98.7% Soil Moisture",
      peakTelemetry: {
        temperature: 28,
        humidity: 88,
        precipitation: 1.2,
        cloudCover: 60,
        windSpeed: 12,
        windDirectionDeg: 85,
        solarRadiation: 580,
        soilMoisture: 0.49,
      },
    },
  },
  ALLSKY_SFC_SW_DWN: {
    title: "Live Solar Irradiance Cone (W/m²)",
    atmosphereColor: "#f59e0b",
    peak: {
      lat: -23.86,
      lng: -69.14,
      name: "Atacama Desert, Chile",
      percentage: "99.6% Peak Solar Flux",
      peakTelemetry: {
        temperature: 27,
        humidity: 14,
        precipitation: 0,
        cloudCover: 2,
        windSpeed: 16,
        windDirectionDeg: 260,
        solarRadiation: 980,
        soilMoisture: 0.04,
      },
    },
  },
};

function degToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((90 - lon) * Math.PI) / 180;
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createRadialTexture(
  innerColor: string,
  midColor: string,
  outerColor: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.5, midColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

async function fetchLiveTelemetry(lat: number, lon: number): Promise<LiveWeatherTelemetry> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,shortwave_radiation&hourly=soil_moisture_0_to_7cm&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API error");
    const json = await res.json();
    const cur = json.current || {};
    const soilArr = json.hourly?.soil_moisture_0_to_7cm || [];
    return {
      temperature: Number(cur.temperature_2m ?? 25),
      humidity: Number(cur.relative_humidity_2m ?? 60),
      precipitation: Number(cur.precipitation ?? 0),
      cloudCover: Number(cur.cloud_cover ?? 20),
      windSpeed: Number(cur.wind_speed_10m ?? 12),
      windDirectionDeg: Number(cur.wind_direction_10m ?? 240),
      solarRadiation: Number(cur.shortwave_radiation ?? 450),
      soilMoisture: Number(soilArr[0] ?? 0.25),
    };
  } catch {
    return {
      temperature: 26,
      humidity: 65,
      precipitation: 0,
      cloudCover: 25,
      windSpeed: 14,
      windDirectionDeg: 225,
      solarRadiation: 500,
      soilMoisture: 0.24,
    };
  }
}

export default function EarthGlobe3D({
  parameter,
  regionA,
  regionB,
  rateA = 0,
  rateB = 0,
  unit,
  variableLabel,
  onInspectGlobalPeak,
}: EarthGlobe3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeInstanceRef = useRef<any>(null);
  const customGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  const [liveA, setLiveA] = useState<LiveWeatherTelemetry | null>(null);
  const [liveB, setLiveB] = useState<LiveWeatherTelemetry | null>(null);
  const [livePeak, setLivePeak] = useState<LiveWeatherTelemetry | null>(null);

  const cfg = GLOBAL_PEAKS[parameter] || GLOBAL_PEAKS.T2M;
  const isHotA = rateA >= 0;
  const isHotB = rateB >= 0;

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchLiveTelemetry(regionA.lat, regionA.lon),
      fetchLiveTelemetry(regionB.lat, regionB.lon),
      fetchLiveTelemetry(cfg.peak.lat, cfg.peak.lng),
    ]).then(([wA, wB, wPeak]) => {
      if (active) {
        setLiveA(wA);
        setLiveB(wB);
        setLivePeak(wPeak);
      }
    });
    return () => {
      active = false;
    };
  }, [regionA.lat, regionA.lon, regionB.lat, regionB.lon, cfg.peak.lat, cfg.peak.lng]);

  useEffect(() => {
    let isMounted = true;

    async function renderDataDrivenGlobe() {
      if (!containerRef.current) return;

      const GlobeModule = await import("globe.gl");
      const Globe = GlobeModule.default;

      if (!isMounted || !containerRef.current) return;

      const width = containerRef.current.offsetWidth || 460;
      const height = containerRef.current.offsetHeight || 440;

      if (!globeInstanceRef.current) {
        const globe = new Globe(containerRef.current)
          .width(width)
          .height(height)
          .backgroundColor("rgba(0,0,0,0)")
          .globeImageUrl("//unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
          .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
          .showAtmosphere(true);

        const controls = globe.controls();
        controls.enableZoom = true;
        controls.minDistance = 140;
        controls.maxDistance = 420;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.45;

        controls.addEventListener("start", () => {
          controls.autoRotate = false;
          setAutoRotate(false);
        });

        globeInstanceRef.current = globe;
      }

      const globe = globeInstanceRef.current;
      globe
        .width(width)
        .height(height)
        .atmosphereColor(cfg.atmosphereColor)
        .atmosphereAltitude(0.2);

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (customGroupRef.current) {
        globe.scene().remove(customGroupRef.current);
      }

      const fxGroup = new THREE.Group();
      customGroupRef.current = fxGroup;
      globe.scene().add(fxGroup);

      const fallbackWeather: LiveWeatherTelemetry = {
        temperature: 26,
        humidity: 65,
        precipitation: 0,
        cloudCover: 25,
        windSpeed: 14,
        windDirectionDeg: 225,
        solarRadiation: 500,
        soilMoisture: 0.24,
      };

      const resolvedPeakTelemetry: LiveWeatherTelemetry = livePeak
        ? {
            ...livePeak,
            precipitation:
              parameter === "PRECTOTCORR"
                ? Math.max(livePeak.precipitation, cfg.peak.peakTelemetry.precipitation)
                : livePeak.precipitation,
            temperature:
              parameter === "T2M"
                ? Math.max(livePeak.temperature, cfg.peak.peakTelemetry.temperature)
                : livePeak.temperature,
            solarRadiation:
              parameter === "ALLSKY_SFC_SW_DWN"
                ? Math.max(livePeak.solarRadiation, cfg.peak.peakTelemetry.solarRadiation)
                : livePeak.solarRadiation,
            soilMoisture:
              parameter === "GWETROOT"
                ? Math.max(livePeak.soilMoisture, cfg.peak.peakTelemetry.soilMoisture)
                : livePeak.soilMoisture,
          }
        : cfg.peak.peakTelemetry;

      const targets = [
        {
          lat: regionA.lat,
          lon: regionA.lon,
          rate: rateA,
          live: liveA || fallbackWeather,
          scale: 1.0,
        },
        {
          lat: regionB.lat,
          lon: regionB.lon,
          rate: rateB,
          live: liveB || fallbackWeather,
          scale: 1.0,
        },
        {
          lat: cfg.peak.lat,
          lon: cfg.peak.lng,
          rate: 0.85,
          live: resolvedPeakTelemetry,
          scale: 1.35,
        },
      ];

      const updaters: ((t: number) => void)[] = [];

      targets.forEach((target) => {
        const surfacePos = latLonToVector3(target.lat, target.lon, 100.35);
        const normal = surfacePos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal
        );

        const northPole = new THREE.Vector3(0, 1, 0);
        const east = northPole.clone().cross(normal).normalize();
        if (east.lengthSq() < 0.001) east.set(1, 0, 0);
        const north = normal.clone().cross(east).normalize();

        if (parameter === "T2M") {
          const temp = target.live.temperature;
          const heatTex =
            temp >= 28
              ? createRadialTexture(
                  "rgba(220, 38, 38, 0.9)",
                  "rgba(249, 115, 22, 0.5)",
                  "rgba(250, 204, 21, 0)"
                )
              : temp >= 16
              ? createRadialTexture(
                  "rgba(245, 158, 11, 0.82)",
                  "rgba(251, 191, 36, 0.4)",
                  "rgba(254, 243, 199, 0)"
                )
              : createRadialTexture(
                  "rgba(2, 132, 199, 0.88)",
                  "rgba(56, 189, 248, 0.45)",
                  "rgba(186, 230, 253, 0)"
                );

          const sphereCapGeo = new THREE.SphereGeometry(
            100.45,
            32,
            32,
            0,
            Math.PI * 2,
            0,
            0.13 * target.scale
          );
          const capMat = new THREE.MeshBasicMaterial({
            map: heatTex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const capMesh = new THREE.Mesh(sphereCapGeo, capMat);
          capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          fxGroup.add(capMesh);
        } else if (parameter === "PRECTOTCORR") {
          const isRaining = target.live.precipitation > 0;

          if (isRaining) {
            const cloudTex = createRadialTexture(
              "rgba(241, 245, 249, 0.94)",
              "rgba(100, 116, 139, 0.55)",
              "rgba(255, 255, 255, 0)"
            );
            const cloudSize = 17 * target.scale;
            const cloudGeo = new THREE.PlaneGeometry(cloudSize, cloudSize);
            const cloudMat = new THREE.MeshBasicMaterial({
              map: cloudTex,
              transparent: true,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
            cloudMesh.position.copy(normal.clone().multiplyScalar(108.5));
            cloudMesh.quaternion.copy(quat);
            fxGroup.add(cloudMesh);

            const dropCount = Math.min(
              220,
              Math.max(80, Math.round(target.live.precipitation * 55 * target.scale))
            );
            const positions = new Float32Array(dropCount * 6);
            const offsets = new Float32Array(dropCount);
            const phases = new Float32Array(dropCount);

            const localCoords: { u: number; v: number }[] = [];
            for (let i = 0; i < dropCount; i++) {
              const r = Math.sqrt(Math.random()) * 5.8 * target.scale;
              const theta = Math.random() * Math.PI * 2;
              localCoords.push({ u: Math.cos(theta) * r, v: Math.sin(theta) * r });
              offsets[i] = Math.random();
              phases[i] = 0.85 + Math.random() * 0.6;
            }

            const rainGeo = new THREE.BufferGeometry();
            rainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const rainMat = new THREE.LineBasicMaterial({
              color: 0x0284c7,
              transparent: true,
              opacity: 0.88,
            });
            const rainLines = new THREE.LineSegments(rainGeo, rainMat);
            fxGroup.add(rainLines);

            updaters.push((time) => {
              const posAttr = rainGeo.getAttribute("position") as THREE.BufferAttribute;
              for (let i = 0; i < dropCount; i++) {
                const progress = (offsets[i] + time * 0.0015 * phases[i]) % 1;
                const altTop = 108.0 - progress * 7.2;
                const altBot = Math.max(100.3, altTop - 1.2);
                const baseOffset = east
                  .clone()
                  .multiplyScalar(localCoords[i].u)
                  .add(north.clone().multiplyScalar(localCoords[i].v));

                const pTop = normal.clone().multiplyScalar(altTop).add(baseOffset);
                const pBot = normal.clone().multiplyScalar(altBot).add(baseOffset);

                posAttr.setXYZ(i * 2, pTop.x, pTop.y, pTop.z);
                posAttr.setXYZ(i * 2 + 1, pBot.x, pBot.y, pBot.z);
              }
              posAttr.needsUpdate = true;
            });
          } else {
            const dryTex = createRadialTexture(
              "rgba(251, 191, 36, 0.35)",
              "rgba(251, 191, 36, 0.12)",
              "rgba(255, 255, 255, 0)"
            );
            const dryGeo = new THREE.PlaneGeometry(14, 14);
            const dryMat = new THREE.MeshBasicMaterial({
              map: dryTex,
              transparent: true,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const dryMesh = new THREE.Mesh(dryGeo, dryMat);
            dryMesh.position.copy(normal.clone().multiplyScalar(100.5));
            dryMesh.quaternion.copy(quat);
            fxGroup.add(dryMesh);
          }
        } else if (parameter === "QV2M") {
          const flowTowardRad = ((target.live.windDirectionDeg + 180) * Math.PI) / 180;
          const flowDir = north
            .clone()
            .multiplyScalar(Math.cos(flowTowardRad))
            .add(east.clone().multiplyScalar(Math.sin(flowTowardRad)))
            .normalize();
          const perpDir = normal.clone().cross(flowDir).normalize();

          const streamCount = Math.round(11 * target.scale);
          const speedScale = Math.max(0.00022, target.live.windSpeed * 0.000022);
          const tracers: {
            curve: THREE.CatmullRomCurve3;
            mesh: THREE.Mesh;
            offset: number;
          }[] = [];

          for (let s = 0; s < streamCount; s++) {
            const lateral = ((s / (streamCount - 1)) - 0.5) * 14 * target.scale;
            const curvePoints: THREE.Vector3[] = [];
            for (let step = 0; step <= 14; step++) {
              const frac = step / 14;
              const along = (frac - 0.5) * 24 * target.scale;
              const wave = Math.sin(frac * Math.PI * 2 + s * 0.45) * 1.1;
              const alt = 101.6 + (s % 3) * 0.35;

              const p = normal
                .clone()
                .multiplyScalar(alt)
                .add(flowDir.clone().multiplyScalar(along))
                .add(perpDir.clone().multiplyScalar(lateral + wave))
                .normalize()
                .multiplyScalar(alt);
              curvePoints.push(p);
            }

            const curve = new THREE.CatmullRomCurve3(curvePoints);
            const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
            const lineMat = new THREE.LineBasicMaterial({
              color: target.live.humidity >= 70 ? 0x0284c7 : 0x6366f1,
              transparent: true,
              opacity: 0.52,
            });
            fxGroup.add(new THREE.Line(lineGeo, lineMat));

            const endPt = curve.getPointAt(0.95);
            const tangentDir = curve.getTangentAt(0.95).normalize();
            const arrowGeo = new THREE.ConeGeometry(0.45, 1.35, 8);
            const arrowMat = new THREE.MeshBasicMaterial({
              color: 0x0284c7,
              transparent: true,
              opacity: 0.92,
            });
            const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
            arrowMesh.position.copy(endPt);
            arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangentDir);
            fxGroup.add(arrowMesh);

            const tracerGeo = new THREE.SphereGeometry(0.32, 8, 8);
            const tracerMat = new THREE.MeshBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.95,
            });
            const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
            fxGroup.add(tracerMesh);
            tracers.push({ curve, mesh: tracerMesh, offset: Math.random() });
          }

          updaters.push((time) => {
            tracers.forEach((tr) => {
              const u = (tr.offset + time * speedScale) % 1;
              tr.mesh.position.copy(tr.curve.getPointAt(u));
            });
          });
        } else if (parameter === "GWETROOT") {
          const wet = target.live.soilMoisture >= 0.25;
          const soilTex = wet
            ? createRadialTexture(
                "rgba(5, 150, 105, 0.88)",
                "rgba(16, 185, 129, 0.45)",
                "rgba(167, 243, 208, 0)"
              )
            : createRadialTexture(
                "rgba(217, 119, 6, 0.85)",
                "rgba(245, 158, 11, 0.42)",
                "rgba(254, 243, 199, 0)"
              );

          const sphereCapGeo = new THREE.SphereGeometry(
            100.45,
            32,
            32,
            0,
            Math.PI * 2,
            0,
            0.13 * target.scale
          );
          const capMat = new THREE.MeshBasicMaterial({
            map: soilTex,
            transparent: true,
            depthWrite: false,
          });
          const capMesh = new THREE.Mesh(sphereCapGeo, capMat);
          capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          fxGroup.add(capMesh);
        } else {
          const rad = target.live.solarRadiation;
          const opacity = rad <= 5 ? 0.05 : Math.min(0.38, 0.12 + (rad / 1000) * 0.28);
          const coneGeo = new THREE.ConeGeometry(8.2 * target.scale, 23, 32, 1, true);
          const coneMat = new THREE.MeshBasicMaterial({
            color: rad <= 5 ? 0x64748b : 0xfbbf24,
            transparent: true,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const coneMesh = new THREE.Mesh(coneGeo, coneMat);
          coneMesh.position.copy(normal.clone().multiplyScalar(111.5));
          coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
          fxGroup.add(coneMesh);
        }
      });

      const tick = (time: number) => {
        updaters.forEach((fn) => fn(time));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      const ringsData = [
        {
          lat: cfg.peak.lat,
          lng: cfg.peak.lng,
          maxR: 9.5,
          propagationSpeed: 2.2,
          repeatPeriod: 1000,
          color: "#f59e0b",
        },
        {
          lat: regionA.lat,
          lng: regionA.lon,
          maxR: 4.5,
          propagationSpeed: 1.8,
          repeatPeriod: 1200,
          color: isHotA ? "#e11d48" : "#0284c7",
        },
        {
          lat: regionB.lat,
          lng: regionB.lon,
          maxR: 4.5,
          propagationSpeed: 1.8,
          repeatPeriod: 1200,
          color: isHotB ? "#f97316" : "#06b6d4",
        },
      ];

      const labelsData = [
        {
          lat: regionA.lat,
          lng: regionA.lon,
          text: `A: ${regionA.name.split(",")[0]} (${rateA > 0 ? "+" : ""}${rateA} ${unit})`,
          size: 1.05,
        },
        {
          lat: regionB.lat,
          lng: regionB.lon,
          text: `B: ${regionB.name.split(",")[0]} (${rateB > 0 ? "+" : ""}${rateB} ${unit})`,
          size: 1.05,
        },
        {
          lat: cfg.peak.lat,
          lng: cfg.peak.lng,
          text: `#1 GLOBAL PEAK: ${cfg.peak.name.split(",")[0]}`,
          size: 1.15,
        },
      ];

      const arcsData = [
        {
          startLat: regionA.lat,
          startLng: regionA.lon,
          endLat: regionB.lat,
          endLng: regionB.lon,
          color: ["rgba(2, 132, 199, 0.7)", "rgba(225, 29, 72, 0.7)"],
        },
      ];

      globe
        .pointsData([])
        .ringsData(ringsData)
        .ringColor((d: { color: string }) => d.color)
        .ringMaxRadius("maxR")
        .ringPropagationSpeed("propagationSpeed")
        .ringRepeatPeriod("repeatPeriod")
        .labelsData(labelsData)
        .labelText("text")
        .labelSize("size")
        .labelDotRadius(0.55)
        .labelColor(() => "#ffffff")
        .labelResolution(3)
        .labelAltitude(0.02)
        .arcsData(arcsData)
        .arcColor("color")
        .arcDashLength(0.5)
        .arcDashGap(0.2)
        .arcDashAnimateTime(1800)
        .arcStroke(0.75);

      const midLat = (regionA.lat + regionB.lat) / 2;
      const midLon = (regionA.lon + regionB.lon) / 2;
      globe.pointOfView({ lat: midLat, lng: midLon, altitude: 1.75 }, 1100);
    }

    renderDataDrivenGlobe();

    const handleResize = () => {
      if (globeInstanceRef.current && containerRef.current) {
        globeInstanceRef.current
          .width(containerRef.current.offsetWidth)
          .height(containerRef.current.offsetHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [parameter, regionA, regionB, rateA, rateB, unit, cfg, isHotA, isHotB, liveA, liveB, livePeak]);

  const flyToGlobalPeak = () => {
    if (!globeInstanceRef.current) return;
    globeInstanceRef.current.controls().autoRotate = false;
    setAutoRotate(false);
    globeInstanceRef.current.pointOfView(
      { lat: cfg.peak.lat, lng: cfg.peak.lng, altitude: 1.55 },
      1200
    );
    if (onInspectGlobalPeak) {
      onInspectGlobalPeak(cfg.peak.lat, cfg.peak.lng, cfg.peak.name);
    }
  };

  const focusRegions = () => {
    if (!globeInstanceRef.current) return;
    const midLat = (regionA.lat + regionB.lat) / 2;
    const midLon = (regionA.lon + regionB.lon) / 2;
    globeInstanceRef.current.pointOfView({ lat: midLat, lng: midLon, altitude: 1.75 }, 1000);
    globeInstanceRef.current.controls().autoRotate = true;
    setAutoRotate(true);
  };

  const renderLiveStatusBadge = (w: LiveWeatherTelemetry | null) => {
    if (!w) return "Syncing live telemetry...";
    if (parameter === "PRECTOTCORR") {
      return w.precipitation > 0
        ? `Raining Now (${w.precipitation} mm/h)`
        : `No Rain Now (Dry • ${w.cloudCover}% clouds)`;
    }
    if (parameter === "QV2M") {
      const towardDeg = (w.windDirectionDeg + 180) % 360;
      return `${w.humidity}% RH • Wind ${w.windSpeed} km/h → ${degToCompass(towardDeg)} (${towardDeg}°)`;
    }
    if (parameter === "T2M") {
      return `Live ${w.temperature}°C • Cloud ${w.cloudCover}%`;
    }
    if (parameter === "GWETROOT") {
      return `Soil ${(w.soilMoisture * 100).toFixed(0)}% Vol • ${w.soilMoisture >= 0.25 ? "Moist" : "Dry"}`;
    }
    return `Live Flux ${w.solarRadiation} W/m² ${w.solarRadiation <= 5 ? "(Night)" : "(Daylight)"}`;
  };

  return (
    <div className="relative w-full h-[440px] sm:h-[470px] flex items-center justify-center bg-gradient-to-b from-sky-100/80 via-white to-slate-100/90 rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      />

      {/* Option 1: Global Climatological #1 Hotspot (Top-Left) */}
      <div className="absolute top-3.5 left-3.5 z-20 bg-white/95 backdrop-blur-md border border-amber-300 shadow-md rounded-2xl p-3 max-w-[245px]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <Trophy className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
              1. Global #1 Benchmark Peak
            </p>
            <p className="text-xs font-bold text-slate-900 truncate">
              {cfg.peak.name}
            </p>
          </div>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-800">
            {cfg.peak.percentage}
          </span>
          <button
            type="button"
            onClick={flyToGlobalPeak}
            className="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg transition shrink-0"
          >
            Fly &amp; Load
          </button>
        </div>
      </div>

      {/* Option 2: Live Synoptic Weather Right Now (Top-Right) */}
      <div className="hidden sm:flex flex-col gap-1.5 absolute top-3.5 right-3.5 z-20 bg-white/95 backdrop-blur-md border border-sky-200 shadow-sm rounded-2xl p-3 max-w-[260px]">
        <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Satellite className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 truncate">
              2. Live Weather (Right Now)
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </div>

        <div className="text-[10px] space-y-1">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            {parameter === "PRECTOTCORR" ? (
              <CloudRain className="w-3 h-3 text-sky-600 shrink-0" />
            ) : parameter === "QV2M" ? (
              <Wind className="w-3 h-3 text-indigo-600 shrink-0" />
            ) : (
              <Sun className="w-3 h-3 text-amber-500 shrink-0" />
            )}
            <span className="truncate">
              <b>A:</b> {renderLiveStatusBadge(liveA)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            {parameter === "PRECTOTCORR" ? (
              <CloudRain className="w-3 h-3 text-rose-600 shrink-0" />
            ) : parameter === "QV2M" ? (
              <Wind className="w-3 h-3 text-indigo-600 shrink-0" />
            ) : (
              <Sun className="w-3 h-3 text-amber-500 shrink-0" />
            )}
            <span className="truncate">
              <b>B:</b> {renderLiveStatusBadge(liveB)}
            </span>
          </div>
        </div>
      </div>

      {/* Option 3: 40-Year NASA POWER Climate Trajectory (Bottom-Right) */}
      <div className="absolute bottom-3.5 right-3.5 z-20 bg-white/95 backdrop-blur-md border border-slate-200 shadow-md rounded-2xl px-3.5 py-2.5 space-y-1.5 min-w-[225px]">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">
          3. NASA POWER 40-Yr Trend (/dec)
        </p>

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1 font-bold text-slate-700 truncate max-w-[115px]">
            {isHotA ? (
              <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            ) : (
              <Snowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            )}
            A: {regionA.name.split(",")[0]}
          </span>
          <span
            className={`font-mono font-extrabold ${
              isHotA ? "text-rose-600" : "text-sky-600"
            }`}
          >
            {rateA > 0 ? "+" : ""}
            {rateA} {unit}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs border-t border-slate-100 pt-1.5">
          <span className="flex items-center gap-1 font-bold text-slate-700 truncate max-w-[115px]">
            {isHotB ? (
              <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            ) : (
              <Snowflake className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            )}
            B: {regionB.name.split(",")[0]}
          </span>
          <span
            className={`font-mono font-extrabold ${
              isHotB ? "text-orange-600" : "text-cyan-600"
            }`}
          >
            {rateB > 0 ? "+" : ""}
            {rateB} {unit}
          </span>
        </div>
      </div>

      {/* Focus Target Regions Button (Bottom-Left) */}
      <button
        type="button"
        onClick={focusRegions}
        className="absolute bottom-3.5 left-3.5 z-20 flex items-center gap-1.5 bg-white/95 hover:bg-white backdrop-blur-md border border-slate-200 shadow-sm rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-700 transition"
      >
        {autoRotate ? (
          <Compass
            className="w-3.5 h-3.5 text-sky-600 animate-spin"
            style={{ animationDuration: "8s" }}
          />
        ) : (
          <LocateFixed className="w-3.5 h-3.5 text-sky-600" />
        )}
        <span>{autoRotate ? "Orbiting Regions" : "Focus Pin A & B"}</span>
      </button>
    </div>
  );
}