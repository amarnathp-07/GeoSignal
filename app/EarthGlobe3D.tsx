"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface EarthGlobe3DProps {
  parameter: string;
  regionA: { name: string; lat: number; lon: number };
  regionB: { name: string; lat: number; lon: number };
  rateA?: number;
  rateB?: number;
  unit: string;
  variableLabel: string;
  gibsLayer?: string;
  gibsOpacity?: number;
  onInspectGlobalPeak: (lat: number, lon: number, name: string) => void;
}

// Map GIBS layer keys to valid NASA WMTS tile or image endpoints
function getGibsTextureUrl(layerKey?: string): string {
  switch (layerKey) {
    case "trueColor":
      // Fallback/Sample equirectangular or tile composite for MODIS Terra True Color
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-01/250m/0/0/0.jpg";
    case "ndvi":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_NDVI_8Day/default/2026-11-01/1km/0/0/0.png";
    case "landTemp":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Aqua_Land_Surface_Temp_Day/default/2026-11-01/km/0/0/0.png";
    case "chlorophyll":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_NOAA20_Chlorophyll_A/default/2026-11-01/km/0/0/0.png";
    case "precipitation":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/GPM_3IMERGHHL_precipitation/default/2026-11-01/0.1deg/0/0/0.png";
    case "soilMoisture":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/SMAP_L4_Root_Zone_Soil_Moisture/default/2026-11-01/9km/0/0/0.png";
    case "aerosol":
      return "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Aqua_Aerosol/default/2026-11-01/1deg/0/0/0.png";
    default:
      // Default earth marble texture
      return "https://unpkg.com/three-globe@2.24.7/example/img/earth-blue-marble.jpg";
  }
}

export default function EarthGlobe3D({
  parameter,
  regionA,
  regionB,
  rateA,
  rateB,
  unit,
  variableLabel,
  gibsLayer = "chlorophyll",
  gibsOpacity = 0.8,
  onInspectGlobalPeak,
}: EarthGlobe3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Globe Sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: gibsOpacity,
    });
    materialRef.current = material;

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Load initial texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";
    const textureUrl = getGibsTextureUrl(gibsLayer);
    
    textureLoader.load(
      textureUrl,
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        // Fallback texture if NASA WMTS tile is blocked or offline
        textureLoader.load(
          "https://unpkg.com/three-globe@2.24.7/example/img/earth-blue-marble.jpg",
          (fallbackTex) => {
            material.map = fallbackTex;
            material.needsUpdate = true;
          }
        );
      }
    );

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      globe.rotation.y += 0.0015; // Slow ambient spin
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentMount) {
        currentMount.innerHTML = "";
      }
      renderer.dispose();
    };
  }, []);

  // Update texture and opacity dynamically when props change
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.opacity = gibsOpacity;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.crossOrigin = "anonymous";
    const textureUrl = getGibsTextureUrl(gibsLayer);

    textureLoader.load(
      textureUrl,
      (texture) => {
        if (materialRef.current) {
          materialRef.current.map = texture;
          materialRef.current.needsUpdate = true;
        }
      },
      undefined,
      () => {
        // Fallback on error
        textureLoader.load(
          "https://unpkg.com/three-globe@2.24.7/example/img/earth-blue-marble.jpg",
          (fallbackTex) => {
            if (materialRef.current) {
              materialRef.current.map = fallbackTex;
              materialRef.current.needsUpdate = true;
            }
          }
        );
      }
    );
  }, [gibsLayer, gibsOpacity]);

  return (
    <div className="relative w-full h-[480px] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Overlay Metadata Badge */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/80 shadow-lg pointer-events-none">
        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
          NASA GIBS Active Telemetry
        </p>
        <p className="text-xs font-extrabold text-white mt-0.5">
          {variableLabel} ({parameter}) • {regionA.name.split(",")[0]}
        </p>
      </div>
    </div>
  );
}