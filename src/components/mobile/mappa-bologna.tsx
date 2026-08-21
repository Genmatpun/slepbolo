"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MobileAnnuncio } from "./mobile-app";

const SEDI = [
  { nome: "Zamboni", lat: 44.4967, lng: 11.3518 },
  { nome: "Terracini", lat: 44.5215, lng: 11.3289 },
  { nome: "Sant'Orsola", lat: 44.488, lng: 11.362 },
  { nome: "Agraria", lat: 44.4995, lng: 11.352 },
];

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Mappa reale, limitata a Bologna, con i pin prezzo delle case. */
export function MappaBologna({
  annunci,
  selId,
  onSelect,
}: {
  annunci: MobileAnnuncio[];
  selId: string | null;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [11.3426, 44.4949],
      zoom: 12.3,
      minZoom: 11,
      maxZoom: 17,
      maxBounds: [
        [11.24, 44.43],
        [11.43, 44.56],
      ],
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marker case + sedi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const s of SEDI) {
      const el = document.createElement("div");
      el.title = s.nome;
      el.style.cssText =
        "width:12px;height:12px;background:#2E5FA3;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);border-radius:99px";
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
    }

    annunci.forEach((a, i) => {
      if (!a.lat || !a.lng) return;
      const on = a.id === selId;
      const el = document.createElement("button");
      el.textContent = `${a.prezzo}€`;
      el.style.cssText = `font-family:Archivo,system-ui,sans-serif;font-size:12px;font-weight:800;padding:4px 8px;border:2px solid #1b1815;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.2);background:${on ? "#a2001d" : "#fffdf9"};color:${on ? "#faf3e7" : "#1b1815"};z-index:${on ? 30 : 10}`;
      el.onclick = (e) => {
        e.stopPropagation();
        onSelect(i);
        map.flyTo({ center: [a.lng, a.lat], zoom: Math.max(map.getZoom(), 14), speed: 0.7 });
      };
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(map));
    });
  }, [annunci, selId, onSelect]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
