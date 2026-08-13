import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "1 camera libera" / "2 camere libere" — attento al singolare. */
export function labelCamereLibere(n: number): string {
  return n === 1 ? "1 camera libera" : `${n} camere libere`;
}

/** Formatta un prezzo in euro senza decimali. */
export function euro(n: number): string {
  return `${n} €`;
}

/** Iniziale maiuscola di un nome, per gli avatar. */
export function iniziale(nome: string): string {
  return nome.trim().charAt(0).toUpperCase();
}
