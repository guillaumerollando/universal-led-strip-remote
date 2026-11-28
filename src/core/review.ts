/**
 * Quand proposer la fenêtre officielle d'avis du Play Store (standard du studio, « Noter l'appli ») : seulement après de
 * vrais bons moments, rarement, jamais au milieu de quelque chose (l'appli la demande en revenant à l'accueil).
 * Bon moment ici : l'appli installée depuis 3 jours, utilisée pour piloter une lumière 3 jours différents.
 */
export interface ReviewState {
  /** Premier lancement (ms). */
  since: number;
  /** Jours (AAAA-MM-JJ) où une lumière a vraiment été pilotée. */
  days: string[];
  /** Fenêtres déjà demandées (ms). */
  asked: number[];
}

const DAY = 86_400_000;
const MIN_INSTALLED = 3 * DAY;
const MIN_DAYS = 3;
const MAX_ASKS = 3;
const SPACING = 120 * DAY;

export const newReviewState = (now: number): ReviewState => ({ since: now, days: [], asked: [] });

const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** Une lumière a été pilotée : retient le jour (10 jours au plus, ça suffit). */
export function noteUse(state: ReviewState, now: number): ReviewState {
  const day = dayOf(now);
  return state.days.includes(day) ? state : { ...state, days: [...state.days, day].slice(-10) };
}

/** Est-ce le moment de demander un avis ? */
export function shouldAskReview(state: ReviewState, now: number): boolean {
  const last = state.asked.at(-1) ?? 0;
  return now - state.since >= MIN_INSTALLED && state.days.length >= MIN_DAYS && state.asked.length < MAX_ASKS && now - last >= SPACING;
}

export const noteAsked = (state: ReviewState, now: number): ReviewState => ({ ...state, asked: [...state.asked, now] });
