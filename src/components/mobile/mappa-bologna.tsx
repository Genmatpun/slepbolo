"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MobileAnnuncio } from "@/lib/annuncio-mobile";
import { SEDI_UNIBO } from "@/lib/constants";
import { PALETTE } from "./stile";

// Le coordinate pubbliche sono già arrotondate dal database a una griglia
// di circa 280 × 280 m: il cerchio copre tutta la cella, così non suggerisce
// un punto preciso che non c'è.
const RAGGIO_AREA_M = 220;

/** Anello (poligono) di un cerchio di raggio rM metri attorno a un punto. */
function anelloCerchio(lng: number, lat: number, rM: number, n = 40): [number, number][] {
  const coords: [number, number][] = [];
  const dLat = rM / 111320;
  const dLng = rM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return coords;
}

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

    // Aree approssimate: posizione non esatta, per privacy
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: annunci
        .filter((a) => a.lat && a.lng)
        .map((a) => ({
          type: "Feature",
          properties: { id: a.id },
          geometry: { type: "Polygon", coordinates: [anelloCerchio(a.lng as number, a.lat as number, RAGGIO_AREA_M)] },
        })),
    };
    const applyAree = () => {
      const src = map.getSource("aree") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource("aree", { type: "geojson", data: fc });
        map.addLayer({ id: "aree-fill", type: "fill", source: "aree", paint: { "fill-color": PALETTE.rosso, "fill-opacity": 0.12 } });
        map.addLayer({ id: "aree-line", type: "line", source: "aree", paint: { "line-color": PALETTE.rosso, "line-width": 1.5, "line-opacity": 0.4 } });
      }
    };
    if (map.isStyleLoaded()) applyAree();
    else map.once("load", applyAree);

    for (const s of SEDI_UNIBO) {
      const el = document.createElement("div");
      el.title = s.nome;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `Sede UniBo: ${s.nome}`);
      el.style.cssText =
        `width:12px;height:12px;background:${PALETTE.sede};border:2px solid ${PALETTE.carta};box-shadow:0 2px 6px rgba(0,0,0,.35);border-radius:99px`;
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
    }

    annunci.forEach((a, i) => {
      if (!a.lat || !a.lng) return;
      const on = a.id === selId;
      const el = document.createElement("button");
      el.type = "button";
      el.textContent = `${a.prezzo}€`;
      el.setAttribute("aria-label", `${a.titolo}, ${a.prezzo} euro al mese`);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.style.cssText = `font-family:Archivo,system-ui,sans-serif;font-size:13px;font-weight:800;min-height:32px;padding:4px 9px;border:2px solid ${PALETTE.ink};cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.2);background:${on ? PALETTE.rosso : PALETTE.carta};color:${on ? PALETTE.crema : PALETTE.ink};z-index:${on ? 30 : 10}`;
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
