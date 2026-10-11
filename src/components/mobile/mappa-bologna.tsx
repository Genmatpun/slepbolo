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

// Spazio occupato da ciò che sta sopra la mappa: titolo in alto, scheda
// della casa e barra delle schede in basso. La mappa inquadra quello che resta.
const MARGINI = { top: 130, bottom: 250, left: 56, right: 56 };

const NESSUNA: string[] = [];

const SEGNALIBRO =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:none"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';

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
  // la cartina è quasi senza colore: così i cerchi rossi e i pallini blu si leggono subito
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.7, "raster-contrast": 0.06 } }],
};

/**
 * Mappa reale, limitata a Bologna, con i pin prezzo delle case.
 * Il credito a OpenStreetMap lo mostra chi la usa, sopra la mappa: in
 * basso finirebbe sotto la barra delle schede.
 */
export function MappaBologna({
  annunci,
  selId,
  onSelect,
  salvate = NESSUNA,
}: {
  annunci: MobileAnnuncio[];
  selId: string | null;
  onSelect: (index: number) => void;
  /** id delle case salvate: il loro pin porta il segnalibro */
  salvate?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const inquadrate = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [11.3426, 44.4949],
      zoom: 12.3,
      minZoom: 11,
      maxZoom: 17,
      // un po' più larga di Bologna: su uno schermo alto serve margine per
      // inquadrare tutte le case senza che finiscano sotto titolo e scheda
      maxBounds: [
        [11.17, 44.37],
        [11.5, 44.62],
      ],
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      inquadrate.current = false;
    };
  }, []);

  // Marker case + sedi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const conPosizione = annunci.filter((a) => a.lat && a.lng);

    // Aree approssimate: posizione non esatta, per privacy
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: conPosizione.map((a) => ({
        type: "Feature",
        properties: { id: a.id },
        geometry: { type: "Polygon", coordinates: [anelloCerchio(a.lng, a.lat, RAGGIO_AREA_M)] },
      })),
    };
    const applyAree = () => {
      const src = map.getSource("aree") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(fc);
      } else {
        map.addSource("aree", { type: "geojson", data: fc });
        map.addLayer({ id: "aree-fill", type: "fill", source: "aree", paint: { "fill-color": PALETTE.rosso, "fill-opacity": 0.14 } });
        map.addLayer({ id: "aree-line", type: "line", source: "aree", paint: { "line-color": PALETTE.rosso, "line-width": 1.5, "line-opacity": 0.5 } });
      }
    };
    if (map.isStyleLoaded()) applyAree();
    else map.once("load", applyAree);

    // Sedi UniBo: un tocco dice quale sede è (il solo pallino non basta)
    for (const s of SEDI_UNIBO) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `Sede UniBo: ${s.nome}`);
      el.style.cssText = "width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;z-index:5";
      const pallino = document.createElement("span");
      pallino.style.cssText = `display:block;width:14px;height:14px;background:${PALETTE.sede};border:2px solid ${PALETTE.carta};box-shadow:0 2px 6px rgba(0,0,0,.35);border-radius:99px`;
      el.append(pallino);
      const popup = new maplibregl.Popup({ offset: 12, closeButton: false, maxWidth: "220px" }).setText(s.nome);
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).setPopup(popup).addTo(map));
    }

    annunci.forEach((a, i) => {
      if (!a.lat || !a.lng) return;
      const on = a.id === selId;
      const salvata = salvate.includes(a.id);
      // il bottone è l'area da toccare (44px); l'etichetta dentro è il pin che si vede
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${a.titolo}, ${a.prezzo} euro al mese${salvata ? ", salvata" : ""}`);
      el.setAttribute("aria-pressed", on ? "true" : "false");
      el.style.cssText = `min-width:48px;min-height:44px;padding:0;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;font-family:inherit;z-index:${on ? 30 : 10}`;
      const pin = document.createElement("span");
      pin.style.cssText = `display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:800;line-height:1;padding:7px 9px;border:2px solid ${PALETTE.ink};white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.2);background:${on ? PALETTE.rosso : PALETTE.carta};color:${on ? PALETTE.crema : PALETTE.ink}`;
      if (salvata) pin.insertAdjacentHTML("afterbegin", SEGNALIBRO);
      pin.append(`${a.prezzo}€`);
      el.append(pin);
      el.onclick = (e) => {
        e.stopPropagation();
        onSelect(i);
        map.flyTo({ center: [a.lng, a.lat], zoom: Math.max(map.getZoom(), 14), speed: 0.7, padding: MARGINI });
      };
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(map));
    });

    // La prima volta inquadra tutte le case; poi tiene in vista quella scelta
    if (!conPosizione.length) return;
    if (!inquadrate.current) {
      inquadrate.current = true;
      const limiti = new maplibregl.LngLatBounds();
      conPosizione.forEach((a) => limiti.extend([a.lng, a.lat]));
      map.fitBounds(limiti, { padding: MARGINI, maxZoom: 14.5, duration: 0 });
      return;
    }
    const scelta = conPosizione.find((a) => a.id === selId);
    if (!scelta) return;
    const p = map.project([scelta.lng, scelta.lat]);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const fuori = p.x < MARGINI.left || p.x > w - MARGINI.right || p.y < MARGINI.top || p.y > h - MARGINI.bottom;
    if (fuori) map.easeTo({ center: [scelta.lng, scelta.lat], padding: MARGINI, duration: 500 });
  }, [annunci, selId, onSelect, salvate]);

  // zIndex 0 chiude i pin in un livello a sé: non salgono sopra la scheda della casa
  return <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />;
}
