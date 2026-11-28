import type { ElkEffect, Rgb } from '../core/elk';
import { remoteById, type IrKey, type IrRemote, type IrRemoteId } from '../core/ir';
import { remoteFromSetup, type IrSetup } from '../core/irSetup';
import { driverOf, stripLength, type Driver } from './drivers';
import { obkScript, obkShowEnd } from './openbeken';
import { calibrationScript } from '../core/calibration';

export { stripLength };
import { sendIrKey } from './ir';
import { AMBIANCE_EFFECT_PREFIX, CREATION_EFFECT_ID, decodeMotif, encodeMotif, MOTIF_EFFECT_ID, type Motif } from '../core/protocols/openbeken';
import { decodeCreation, encodeCreation, type Creation } from '../core/creations';
import { BUILTIN_AMBIANCES } from '../core/ambiances';
import { nearestColorKey } from '../core/scenes';
import { kelvinToRgb } from '../core/white';
import { lightKind } from '../core/describe';
import { getDevice, rememberState, updateDevice, type LightState } from './store';
import { t as tr } from '../i18n';
import { track, type SendKind } from './sending';
import { noteLightUsed } from './review';

/** Ce dont la commande a besoin pour joindre un appareil (enregistré ou juste détecté). */
export interface Target {
  key: string;
  family: string;
  address: string;
  rawName: string;
  model?: string;
  irRemote?: IrRemoteId;
  ir?: IrSetup;
  state?: LightState;
  /** Ce que le pilote doit retenir (jeton, numéro de lampe, port…). */
  meta?: Record<string, string>;
}

/** La télécommande d'un ruban infrarouge (configuré par l'assistant, ou ancien format). */
export function irRemoteOf(t: Target): IrRemote | undefined {
  if (t.ir) return remoteFromSetup(t.ir);
  if (t.irRemote) return remoteById(t.irRemote);
  return undefined;
}

function irKey(t: Target, kinds: IrKey['kind'][]): IrKey | undefined {
  return irRemoteOf(t)?.keys.find((k) => kinds.includes(k.kind));
}

/** l'appli sait-il allumer et éteindre cet appareil lui-même ? */
export function canPower(t: Target): boolean {
  return !!driverOf(t) || (t.family === 'ir-nec' && !!irRemoteOf(t));
}

/** Couleur et luminosité pilotables directement (rubans Bluetooth et Wi-Fi ; l'infrarouge a ses touches). */
export function canColor(t: Target): boolean {
  const d = driverOf(t);
  return !!d?.color && (d.hasColor?.(t) ?? true);
}
export const canDim = (t: Target): boolean => !!driverOf(t)?.brightness;

function need<K extends keyof Driver>(t: Target, what: K, message: string): NonNullable<Driver[K]> {
  const fn = driverOf(t)?.[what];
  if (!fn) throw new Error(message);
  return fn as NonNullable<Driver[K]>;
}

async function setPowerNow(t: Target, on: boolean): Promise<void> {
  const driver = driverOf(t);
  if (driver) {
    await driver.power(t, on);
  } else if (t.family === 'ir-nec' && irRemoteOf(t)) {
    const remote = irRemoteOf(t)!;
    const direct = irKey(t, [on ? 'power-on' : 'power-off']);
    if (direct) await sendIrKey(remote, direct);
    else {
      // Une seule touche marche/arrêt : on ne l'envoie que si l'état connu est l'inverse.
      const toggle = irKey(t, ['power-toggle']);
      if (toggle && t.state?.on !== on) await sendIrKey(remote, toggle);
    }
  } else {
    throw new Error(tr('L’appli ne sait pas encore allumer cet appareil.'));
  }
  await rememberState(t.key, { on });
}

async function setColorNow(t: Target, rgb: Rgb): Promise<void> {
  await need(t, 'color', tr('Couleur non gérée pour cet appareil.'))(t, rgb);
  await rememberState(t.key, { rgb, on: true, effect: undefined, kelvin: undefined });
}

/** La lumière a de vraies LED blanches réglables (chaud / froid). */
function hasRealWhite(t: Target): boolean {
  const d = driverOf(t);
  return !!d?.white && (d.hasWhite?.(t) ?? true);
}
/** On peut lui donner un blanc chaud / froid : de vraies LED blanches, ou une couleur qui s'en approche. */
export const canWhite = (t: Target): boolean => hasRealWhite(t) || canColor(t);

/**
 * Un blanc, du chaud (bougie) au froid (lumière du jour). Les lumières à LED blanches le font vraiment ; les autres
 * prennent la couleur la plus proche.
 */
async function setWhiteNow(t: Target, kelvin: number): Promise<void> {
  const rgb = kelvinToRgb(kelvin);
  if (hasRealWhite(t)) await driverOf(t)!.white!(t, kelvin);
  else await need(t, 'color', tr('Couleur non gérée pour cet appareil.'))(t, rgb);
  await rememberState(t.key, { kelvin, rgb, on: true, effect: undefined });
}

/** Aperçu d'un blanc pendant qu'on fait glisser le curseur (sans le retenir). */
export async function previewWhite(t: Target, kelvin: number): Promise<void> {
  if (hasRealWhite(t)) await driverOf(t)!.white!(t, kelvin);
  else await driverOf(t)?.color?.(t, kelvinToRgb(kelvin));
}

/** Envoie une couleur sans la retenir : pendant qu'on fait glisser le doigt sur l'arc-en-ciel. */
export async function previewColor(t: Target, rgb: Rgb): Promise<void> {
  await driverOf(t)?.color?.(t, rgb);
}

/**
 * Expéditeur « le dernier gagne » : pendant un glissement, on n'envoie jamais plus d'une trame à la fois,
 * et seule la dernière valeur demandée part ensuite (le Bluetooth de ces contrôleurs est lent).
 */
export function latestWins<T>(send: (value: T) => Promise<void>): ((value: T) => void) & { idle: (dropPending?: boolean) => Promise<void> } {
  let busy = false;
  let pending: { value: T } | null = null;
  let waiters: (() => void)[] = [];
  const pump = (value: T): void => {
    busy = true;
    send(value)
      .catch(() => undefined)
      .finally(() => {
        busy = false;
        if (pending) {
          const next = pending.value;
          pending = null;
          pump(next);
        } else {
          waiters.forEach((w) => w());
          waiters = [];
        }
      });
  };
  const fn = (value: T): void => {
    if (busy) pending = { value };
    else pump(value);
  };
  /**
   * Attend la fin des envois en cours, et oublie celui qui attendait : la valeur finale (au lâcher du doigt) part
   * ensuite seule, sans croiser un aperçu encore en route (le ruban Wi-Fi répondait « pas de réponse »).
   */
  const idle = (dropPending = true): Promise<void> => {
    if (dropPending) pending = null;
    return busy ? new Promise<void>((resolve) => waiters.push(resolve)) : Promise.resolve();
  };
  return Object.assign(fn, { idle });
}

async function setBrightnessNow(t: Target, percent: number): Promise<void> {
  await need(t, 'brightness', tr('Luminosité non gérée pour cet appareil.'))(t, percent);
  // Luminosité envoyée comme une couleur : l'effet en cours est remplacé, l'appli ne doit plus l'afficher.
  await rememberState(t.key, driverOf(t)?.brightnessIsColor ? { brightness: percent, effect: undefined } : { brightness: percent });
}

/** Envoie une luminosité sans la retenir : pendant qu'on fait glisser le doigt le long du ruban. */
export async function previewBrightness(t: Target, percent: number): Promise<void> {
  const d = driverOf(t);
  // Certains rubans ne suivent pas en direct (ruban à pixels qui joue une ambiance : tout son script est réécrit) :
  // ils ne prennent que la valeur finale.
  if (d?.liveBrightness && !d.liveBrightness(t)) return;
  await d?.brightness?.(t, percent);
}

/** `rgb` : couleur des animations qui en prennent une (ambiances « comète orange »…). */
async function setEffectNow(t: Target, effect: ElkEffect, rgb?: Rgb, speed = t.state?.speed ?? 55): Promise<void> {
  await need(t, 'effect', tr('L’appli ne sait pas encore allumer cet appareil.'))(t, effect, speed, rgb);
  await rememberState(t.key, { effect: effect.id, on: true, speed, ...(rgb ? { rgb } : {}) });
}

async function setSpeedNow(t: Target, percent: number): Promise<void> {
  await driverOf(t)?.speed?.(t, percent);
  await rememberState(t.key, { speed: percent });
}

export const effectsFor = (t: Target): ElkEffect[] => driverOf(t)?.effects?.(t) ?? [];
/** Tous les effets intégrés du contrôleur (pour les bidouilleurs). */
export const catalogFor = (t: Target): ElkEffect[] => driverOf(t)?.catalog?.(t) ?? [];

/**
 * Les couleurs de la lumière en cours quand c'est un effet ou une ambiance (arc-en-ciel, Noël…) : l'interface en
 * habille le ruban dessiné et le bouton. Undefined pour une couleur unie.
 */
export function lightColors(t: Target): Rgb[] | undefined {
  const effect = t.state?.effect;
  if (!effect) return undefined;
  const source =
    effect === MOTIF_EFFECT_ID
      ? motifOf(t)?.pixels
      : effect === CREATION_EFFECT_ID
        ? decodeCreation(t.meta?.creation)?.colors
      : effect.startsWith(AMBIANCE_EFFECT_PREFIX)
        ? BUILTIN_AMBIANCES.find((a) => AMBIANCE_EFFECT_PREFIX + a.id === effect)?.colors
        : [...effectsFor(t), ...catalogFor(t)].find((e) => e.id === effect)?.preview;
  const seen = new Set<string>();
  const list = (source ?? []).filter((c) => {
    const k = `${c.r},${c.g},${c.b}`;
    if (c.r + c.g + c.b < 60 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return list.length >= 2 ? list : undefined;
}

/**
 * Les ambiances de l'appli que ce ruban sait jouer : les siennes (ruban à pixels, MELK), et pour tout ruban qui sait
 * prendre une couleur (ou une télécommande à touches de couleur), leur version simple — la bonne couleur.
 */
export function ambiancesFor(t: Target): string[] {
  const own = driverOf(t)?.ambiances?.(t) ?? [];
  const ir = irRemoteOf(t);
  const colorable = ir ? ir.keys.some((k) => k.kind === 'color') : canColor(t);
  // Lumière à blancs seulement (Hue White Ambiance, Elgato Key Light) : les ambiances qui ont un blanc.
  const whiteOnly = !ir && !colorable && hasRealWhite(t);
  return BUILTIN_AMBIANCES.filter((a) => own.includes(a.id) || (colorable && a.simple) || (whiteOnly && a.bulb?.kelvin)).map((a) => a.id);
}

/** Le ruban sait-il faire défiler un motif dessiné pixel par pixel ? */
export const canMotif = (t: Target): boolean => !!driverOf(t)?.hasMotif?.(t);
/** Le dernier motif envoyé à ce ruban (ambiance ou dessin), s'il y en a un. */
export const motifOf = (t: Target): Motif | undefined => decodeMotif(t.meta?.motif);
/** L'ambiance de l'appli qui tourne sur ce ruban, s'il y en a une. */
export const ambianceRunning = (t: Target): string | undefined =>
  t.state?.effect?.startsWith(AMBIANCE_EFFECT_PREFIX) ? t.state.effect.slice(AMBIANCE_EFFECT_PREFIX.length) : undefined;

/** La création de l'utilisateur qui tourne sur ce ruban, s'il y en a une. */
export const creationOf = (t: Target): Creation | undefined =>
  t.state?.effect === CREATION_EFFECT_ID ? decodeCreation(t.meta?.creation) : undefined;

/** Lance une création (« Créer mon ambiance ») : le ruban la joue lui-même ; on la retient pour la reconstruire. */
async function setCreationNow(t: Target, c: Creation): Promise<void> {
  await need(t, 'creation', tr('L’appli ne sait pas encore allumer cet appareil.'))(t, c);
  const saved = getDevice(t.key);
  if (saved) await updateDevice(t.key, { meta: { ...saved.meta, creation: encodeCreation(c) } });
  await rememberState(t.key, { effect: CREATION_EFFECT_ID, on: true, speed: c.speed });
}

/** Calibrage : le ruban s'allume en arc-en-ciel sur toute la longueur annoncée par sa configuration. */
export async function showCalibration(t: Target): Promise<void> {
  // Provisoire : pas gardé au démarrage (sinon l'arc-en-ciel reviendrait après une coupure de courant).
  await obkScript(t.address, calibrationScript(Number(t.meta?.pixels) || 100), false);
  await rememberState(t.key, { effect: undefined });
}

/** Règle la longueur réelle d'un ruban à pixels et allume sa dernière LED, pour vérifier qu'elle est bien au bout. */
export async function setStripLength(t: Target, length: number): Promise<void> {
  const saved = getDevice(t.key);
  if (saved) await updateDevice(t.key, { meta: { ...saved.meta, length: String(length) } });
  await obkShowEnd(t.address, length);
  await rememberState(t.key, { effect: undefined });
}

/** Lance une ambiance de l'appli (Noël, Aurore…) : le ruban la joue lui-même. */
async function setAmbianceNow(t: Target, id: string): Promise<void> {
  const own = driverOf(t)?.ambiances?.(t) ?? [];
  const ambiance = BUILTIN_AMBIANCES.find((a) => a.id === id);
  const simple = ambiance?.simple;
  const ir = irRemoteOf(t);
  // Une ampoule éclaire toute la pièce : sa version à elle (blanc chaud, plus doux), si l'ambiance en a une.
  const bulb = !ir && !own.includes(id) && lightKind(t as Parameters<typeof lightKind>[0]) === 'bulb' ? ambiance?.bulb : undefined;
  if (own.includes(id)) await need(t, 'ambiance', tr('L’appli ne sait pas encore allumer cet appareil.'))(t, id);
  else if (simple && ir) {
    // Télécommande : on allume, puis sa touche d'effet si l'ambiance en prévoit une, sinon la couleur la plus proche.
    if (!t.state?.on) await setPower(t, true);
    const key = (simple.effect && ir.keys.find((k) => k.kind === 'effect' && k.id === simple.effect)) || nearestColorKey(ir.keys, simple.color);
    if (key) await pressIrKey(getDevice(t.key) ?? t, key);
  } else if (bulb?.kelvin && canWhite(t)) {
    if (!t.state?.on) await setPower(t, true);
    await setWhite(getDevice(t.key) ?? t, bulb.kelvin);
  } else if (simple && canColor(t)) {
    if (!t.state?.on) await setPower(t, true);
    await setColor(getDevice(t.key) ?? t, simple.color);
  } else throw new Error(tr('L’appli ne sait pas encore allumer cet appareil.'));
  if (bulb?.brightness !== undefined && canDim(t)) await setBrightness(getDevice(t.key) ?? t, bulb.brightness);
  await rememberState(t.key, { effect: AMBIANCE_EFFECT_PREFIX + id, on: true });
}

/** Envoie un motif (ambiance ou dessin) au ruban, le retient avec l'appareil, et en fait l'effet en cours. */
async function setMotifNow(t: Target, motif: Motif, speed = t.state?.speed ?? 55): Promise<void> {
  await need(t, 'motif', tr('L’appli ne sait pas encore allumer cet appareil.'))(t, motif, speed);
  const saved = getDevice(t.key);
  if (saved) await updateDevice(t.key, { meta: { ...saved.meta, motif: encodeMotif(motif) } });
  await rememberState(t.key, { effect: MOTIF_EFFECT_ID, on: true, speed });
}

/** Appuie sur une touche d'un ruban infrarouge (couleur, luminosité, effet) et retient ce que ça change. */
async function pressIrKeyNow(t: Target, key: IrKey): Promise<void> {
  const remote = irRemoteOf(t);
  if (!remote) throw new Error(tr('Ruban infrarouge non configuré.'));
  await sendIrKey(remote, key);
  if (key.kind === 'color') await rememberState(t.key, { rgb: key.rgb, on: true, effect: undefined });
  else if (key.kind === 'effect') await rememberState(t.key, { effect: key.id, on: true });
  else if (key.kind === 'power-on' || key.kind === 'power-off') await rememberState(t.key, { on: key.kind === 'power-on' });
  else if (key.kind === 'power-toggle') await rememberState(t.key, { on: !t.state?.on });
}

export interface GroupResult {
  ok: string[];
  failed: { key: string; message: string }[];
}

/**
 * Allume ou éteint plusieurs appareils. Un par un : le Bluetooth du téléphone gère mal
 * plusieurs connexions simultanées, et l'infrarouge n'a qu'un émetteur.
 */
export async function setGroupPower(targets: Target[], on: boolean): Promise<GroupResult> {
  const result: GroupResult = { ok: [], failed: [] };
  for (const t of targets.filter(canPower)) {
    try {
      await setPower(t, on);
      result.ok.push(t.key);
    } catch (e) {
      result.failed.push({ key: t.key, message: (e as Error).message });
    }
  }
  return result;
}

/** Les envois vers un ruban, suivis (`services/sending`) : l'interface sait qu'il va suivre. */
function tracked<A extends unknown[]>(kind: SendKind, fn: (t: Target, ...a: A) => Promise<void>): (t: Target, ...a: A) => Promise<void> {
  // Un envoi réussi compte comme un jour d'usage (fenêtre d'avis du Play Store, `services/review`).
  return (t, ...a) => track(t.key, kind, fn(t, ...a).then(noteLightUsed));
}
export const setPower = tracked('power', setPowerNow);
export const setColor = tracked('color', setColorNow);
export const setWhite = tracked('color', setWhiteNow);
export const setBrightness = tracked('brightness', setBrightnessNow);
export const setEffect = tracked('effect', setEffectNow);
export const setSpeed = tracked('effect', setSpeedNow);
export const setCreation = tracked('effect', setCreationNow);
export const setAmbiance = tracked('effect', setAmbianceNow);
export const setMotif = tracked('effect', setMotifNow);
export const pressIrKey = tracked('color', pressIrKeyNow);
