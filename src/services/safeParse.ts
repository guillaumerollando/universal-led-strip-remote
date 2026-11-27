/** Relit un texte JSON enregistré ; s'il est abîmé, la valeur par défaut au lieu d'un plantage. */
export function safeParse<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
