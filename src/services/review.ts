import AsyncStorage from '@react-native-async-storage/async-storage';

import native from '../../modules/led-strip-native/src';
import { newReviewState, noteAsked, noteUse, shouldAskReview, type ReviewState } from '../core/review';
import { safeParse } from './safeParse';

/** Fenêtre officielle d'avis du Play Store : rarement, après de vrais bons moments (`core/review.ts`). */
const KEY = 'ledstrip.review.v1';
let state: ReviewState | null = null;

async function load(): Promise<ReviewState> {
  if (state) return state;
  const text = await AsyncStorage.getItem(KEY).catch(() => null);
  state = safeParse<ReviewState | null>(text, null) ?? newReviewState(Date.now());
  if (!text) void save();
  return state;
}

const save = (): Promise<void> => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);

/** Une lumière a bien été pilotée : retient le jour. */
export function noteLightUsed(): void {
  void load().then((s) => {
    const next = noteUse(s, Date.now());
    if (next !== s) {
      state = next;
      void save();
    }
  });
}

/** En revenant à l'accueil : si c'est le bon moment, Android montre sa petite fenêtre d'avis (ou rien). */
export async function maybeAskReview(): Promise<void> {
  if (!native?.requestReview) return;
  const s = await load();
  if (!shouldAskReview(s, Date.now())) return;
  state = noteAsked(s, Date.now());
  await save();
  await native.requestReview().catch(() => undefined);
}
