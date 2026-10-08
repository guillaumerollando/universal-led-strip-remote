import { elkBrightness, elkColor, elkEffect, elkEffects, elkPower, elkSpeed, type ElkEffect, type ElkModel, type Rgb } from '../core/elk';
import { elkModel } from '../core/identify';
import { remoteById, type IrKey, type IrRemote, type IrRemoteId } from '../core/ir';
import { remoteFromSetup, type IrSetup } from '../core/irSetup';
import { sendElk } from './ble';
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
}

/** La télécommande d'un ruban infrarouge (configuré par l'assistant, ou ancien format). */
export function irRemoteOf(t: Target): IrRemote | undefined {
  if (t.ir) return remoteFromSetup(t.ir);
  if (t.irRemote) return remoteById(t.irRemote);
  return undefined;
}

const modelOf = (t: Target): ElkModel => elkModel(t.rawName);

function irKey(t: Target, kinds: IrKey['kind'][]): IrKey | undefined {
  return irRemoteOf(t)?.keys.find((k) => kinds.includes(k.kind));
}

/** Rubanix sait-il allumer et éteindre cet appareil lui-même ? */
export function canPower(t: Target): boolean {
  return t.family === 'elk-bledom' || (t.family === 'ir-nec' && !!irRemoteOf(t));
}

export async function setPower(t: Target, on: boolean): Promise<void> {
  if (t.family === 'elk-bledom') {
    await sendElk(t.address, modelOf(t), elkPower(modelOf(t), on));
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
  if (t.family !== 'elk-bledom') throw new Error(tr('Couleur non gérée pour cet appareil.'));
  await sendElk(t.address, modelOf(t), elkColor(modelOf(t), rgb));
  await rememberState(t.key, { rgb, on: true, effect: undefined });
}

/** Envoie une couleur sans la retenir : pendant qu'on fait glisser le doigt sur l'arc-en-ciel. */
export async function previewColor(t: Target, rgb: Rgb): Promise<void> {
  if (t.family !== 'elk-bledom') return;
  await sendElk(t.address, modelOf(t), elkColor(modelOf(t), rgb));
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
  if (t.family !== 'elk-bledom') throw new Error(tr('Luminosité non gérée pour cet appareil.'));
  await sendElk(t.address, modelOf(t), elkBrightness(modelOf(t), percent));
  await rememberState(t.key, { brightness: percent });
}

export async function setEffect(t: Target, effect: ElkEffect): Promise<void> {
  await sendElk(t.address, modelOf(t), elkEffect(modelOf(t), effect.code));
  await rememberState(t.key, { effect: effect.id, on: true });
}

export async function setSpeed(t: Target, percent: number): Promise<void> {
  await sendElk(t.address, modelOf(t), elkSpeed(modelOf(t), percent));
  await rememberState(t.key, { speed: percent });
}

export const effectsFor = (t: Target): ElkEffect[] => (t.family === 'elk-bledom' ? elkEffects(modelOf(t)) : []);

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
