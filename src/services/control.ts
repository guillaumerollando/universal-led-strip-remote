import type { ElkEffect, Rgb } from '../core/elk';
import { remoteById, type IrKey, type IrRemote, type IrRemoteId } from '../core/ir';
import { remoteFromSetup, type IrSetup } from '../core/irSetup';
import { driverOf, type Driver } from './drivers';
import { sendIrKey } from './ir';
import { rememberState, type LightState } from './store';
import { t as tr } from '../i18n';

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

export async function setPower(t: Target, on: boolean): Promise<void> {
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

export async function setColor(t: Target, rgb: Rgb): Promise<void> {
  await need(t, 'color', tr('Couleur non gérée pour cet appareil.'))(t, rgb);
  await rememberState(t.key, { rgb, on: true, effect: undefined });
}

/** Envoie une couleur sans la retenir : pendant qu'on fait glisser le doigt sur l'arc-en-ciel. */
export async function previewColor(t: Target, rgb: Rgb): Promise<void> {
  await driverOf(t)?.color?.(t, rgb);
}

/**
 * Expéditeur « le dernier gagne » : pendant un glissement, on n'envoie jamais plus d'une trame à la fois,
 * et seule la dernière valeur demandée part ensuite (le Bluetooth de ces contrôleurs est lent).
 */
export function latestWins<T>(send: (value: T) => Promise<void>): (value: T) => void {
  let busy = false;
  let pending: { value: T } | null = null;
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
        }
      });
  };
  return (value: T) => {
    if (busy) pending = { value };
    else pump(value);
  };
}

export async function setBrightness(t: Target, percent: number): Promise<void> {
  await need(t, 'brightness', tr('Luminosité non gérée pour cet appareil.'))(t, percent);
  await rememberState(t.key, { brightness: percent });
}

/** Envoie une luminosité sans la retenir : pendant qu'on fait glisser le doigt le long du ruban. */
export async function previewBrightness(t: Target, percent: number): Promise<void> {
  await driverOf(t)?.brightness?.(t, percent);
}

export async function setEffect(t: Target, effect: ElkEffect): Promise<void> {
  await need(t, 'effect', tr('L’appli ne sait pas encore allumer cet appareil.'))(t, effect, t.state?.speed ?? 55);
  await rememberState(t.key, { effect: effect.id, on: true });
}

export async function setSpeed(t: Target, percent: number): Promise<void> {
  await driverOf(t)?.speed?.(t, percent);
  await rememberState(t.key, { speed: percent });
}

export const effectsFor = (t: Target): ElkEffect[] => driverOf(t)?.effects?.(t) ?? [];

/** Appuie sur une touche d'un ruban infrarouge (couleur, luminosité, effet) et retient ce que ça change. */
export async function pressIrKey(t: Target, key: IrKey): Promise<void> {
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
