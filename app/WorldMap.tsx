"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface WorldMapProps {
  regionA: { name: string; lat: number; lon: number };
  regionB: { name: string; lat: number; lon: number };
  onSelectRegionA: (lat: number, lon: number) => void;
  onSelectRegionB: (lat: number, lon: number) => void;
}

const TILE_LAYERS = {
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
  },
  street: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

export default function WorldMap({
  regionA,
  regionB,
  onSelectRegionA,
  onSelectRegionB,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Default to Satellite view with toggle option for Street map
  const [mapStyle, setMapStyle] = useState<"satellite" | "street">("satellite");

  const callbacksRef = useRef({ onSelectRegionA, onSelectRegionB });
  callbacksRef.current = { onSelectRegionA, onSelectRegionB };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const midLat = (regionA.lat + regionB.lat) / 2;
    const midLon = (regionA.lon + regionB.lon) / 2;

    const map = L.map(containerRef.current, {
      center: [midLat, midLon],
      zoom: 4,
      scrollWheelZoom: true,
    });

    const initialLayer = L.tileLayer(TILE_LAYERS.satellite.url, {
      maxZoom: 18,
      attribution: TILE_LAYERS.satellite.attribution,
    }).addTo(map);

    tileLayerRef.current = initialLayer;

    map.on("click", (e: L.LeafletMouseEvent) => {
      callbacksRef.current.onSelectRegionA(
        Number(e.latlng.lat.toFixed(2)),
        Number(e.latlng.lng.toFixed(2))
      );
    });

    map.on("contextmenu", (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      callbacksRef.current.onSelectRegionB(
        Number(e.latlng.lat.toFixed(2)),
        Number(e.latlng.lng.toFixed(2))
      );
    });

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap between Satellite and Street tiles smoothly when toggled
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const selected = TILE_LAYERS[mapStyle];
    const nextLayer = L.tileLayer(selected.url, {
      maxZoom: 18,
      attribution: selected.attribution,
    }).addTo(map);

    nextLayer.bringToBack();
    tileLayerRef.current = nextLayer;
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    L.polyline(
      [
        [regionA.lat, regionA.lon],
        [regionB.lat, regionB.lon],
      ],
      {
        color: "#38bdf8",
        weight: 2.5,
        dashArray: "6, 6",
        opacity: 0.9,
      }
    ).addTo(group);

    L.circleMarker([regionA.lat, regionA.lon], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#0284c7",
      fillOpacity: 0.95,
    })
      .bindTooltip(`Pin A: ${regionA.name.split(",")[0]}`, {
        permanent: true,
        direction: "left",
        offset: [-10, 0],
      })
      .addTo(group);

    L.circleMarker([regionB.lat, regionB.lon], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#e11d48",
      fillOpacity: 0.95,
    })
      .bindTooltip(`Pin B: ${regionB.name.split(",")[0]}`, {
        permanent: true,
        direction: "right",
        offset: [10, 0],
      })
      .addTo(group);

    const midLat = (regionA.lat + regionB.lat) / 2;
    const midLon = (regionA.lon + regionB.lon) / 2;
    map.setView([midLat, midLon], map.getZoom(), { animate: true });
  }, [regionA, regionB]);

  return (
    <div className="relative w-full h-full min-h-[340px]">
      <div ref={containerRef} className="w-full h-full min-h-[340px] z-10" />

      {/* Floating Satellite / Street Map Switcher (Top-Right of Map) */}
      <div className="absolute top-2.5 right-2.5 z-[400] flex rounded-xl bg-white/95 backdrop-blur-md p-1 shadow-md border border-slate-200 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setMapStyle("satellite")}
          className={`px-2.5 py-1 rounded-lg transition ${
            mapStyle === "satellite"
              ? "bg-sky-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("street")}
          className={`px-2.5 py-1 rounded-lg transition ${
            mapStyle === "street"
              ? "bg-sky-600 text-white shadow-2xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Street Map
        </button>
      </div>
    </div>
  );
}