// Geocoding gratuito con Nominatim (OpenStreetMap).
// Usiamo solo la via, mai il civico: la scheda pubblica non deve rivelare l'indirizzo esatto.

export interface Geocodato {
  lat: number;
  lng: number;
}

export async function geocodaVia(via: string, zona: string): Promise<Geocodato | null> {
  const q = encodeURIComponent(`${via}, ${zona}, Bologna, Italia`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=it`,
      { headers: { "Accept-Language": "it" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
