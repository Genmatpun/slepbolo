"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import type { Annuncio } from "@/lib/types";
import { prezzoDa, camereLibere } from "@/lib/types";
import { SEDI_UNIBO } from "@/lib/constants";
import { labelCamereLibere } from "@/lib/utils";
import { cn } from "@/lib/utils";

const OSM_STYLE: maplibregl.StyleSpecification = {
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

export function MappaView({ annunci }: { annunci: Annuncio[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [attivo, setAttivo] = useState<string | null>(null);
  const conCoord = annunci.filter((a) => a.lat && a.lng);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [11.3426, 44.4949],
      zoom: 12.4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marker annunci + sedi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    // Sedi UniBo (blu)
    for (const s of SEDI_UNIBO) {
      const el = document.createElement("div");
      el.className = "sede-marker";
      el.title = s.nome;
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
    }

    // Annunci (rosso, con prezzo)
    for (const a of conCoord) {
      const el = document.createElement("button");
      el.className = "pin-annuncio";
      el.textContent = `${prezzoDa(a)} €`;
      el.onclick = () => {
        setAttivo(a.id);
        map.flyTo({ center: [a.lng!, a.lat!], zoom: 14, speed: 0.8 });
      };
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng!, a.lat!]).addTo(map));
    }

    return () => markers.forEach((m) => m.remove());
  }, [conCoord]);

  return (
    <div className="grid min-h-[560px] overflow-hidden rounded-[--radius-lg] border border-linea bg-carta shadow-[var(--shadow-morbida)] lg:grid-cols-[1fr_300px]">
      <div className="relative min-h-[400px]">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-linea bg-carta/95 px-3 py-2.5 text-[11.5px]">
          <Legend colore="var(--color-rosso)" testo="Annuncio" />
          <Legend colore="#2E5FA3" testo="Sede UniBo" />
        </div>
      </div>

      <div className="max-h-[560px] overflow-y-auto border-t border-linea p-4 lg:border-l lg:border-t-0">
        {conCoord.map((a) => (
          <Link
            key={a.id}
            href={`/annuncio/${a.id}`}
            onMouseEnter={() => setAttivo(a.id)}
            className={cn(
              "flex gap-3 rounded-xl border-[1.5px] border-transparent p-3 transition hover:bg-crema",
              attivo === a.id && "border-rosso bg-crema",
            )}
          >
            <div
              className="h-14 w-14 flex-shrink-0 rounded-[10px]"
              style={{ background: "linear-gradient(135deg,#A2001D,#E4572E)" }}
            />
            <div className="min-w-0">
              <b className="block text-[13.5px] leading-[1.25]">{a.titolo}</b>
              <span className="text-[12px] text-grigio">{a.zona}</span>
              <div className="text-[13.5px] font-bold text-rosso">
                {prezzoDa(a)} € · {labelCamereLibere(camereLibere(a))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        .sede-marker{width:14px;height:14px;border-radius:50%;background:#2E5FA3;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:default}
        .pin-annuncio{background:var(--color-rosso);color:#fff;font-size:12.5px;font-weight:700;padding:5px 10px;border-radius:99px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.22);cursor:pointer;white-space:nowrap}
        .pin-annuncio:hover{background:var(--color-inchiostro)}
      `}</style>
    </div>
  );
}

function Legend({ colore, testo }: { colore: string; testo: string }) {
  return (
    <div className="my-[3px] flex items-center gap-[7px] font-semibold text-grigio">
      <span className="h-[11px] w-[11px] rounded-[3px]" style={{ background: colore }} />
      {testo}
    </div>
  );
}
