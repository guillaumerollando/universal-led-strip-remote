import { Buffer } from 'buffer';
import dgram from 'react-native-udp';

import type { HttpCall } from '../core/protocols/types';
import native from '../../modules/rubanix-native/src';
import { t } from '../i18n';

const noAnswer = (): Error => new Error(t('Pas de réponse : vérifie qu’il est allumé et sur le même Wi-Fi.'));

/** Requête HTTP locale avec délai court ; renvoie le JSON (ou le texte) de la réponse. */
export async function http(ip: string, call: HttpCall, timeoutMs = 4000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${ip}${call.port ? `:${call.port}` : ''}${call.path}`, {
      method: call.method,
      headers: call.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok && res.status !== 403) throw new Error(`HTTP ${res.status}`);
    try {
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return text;
    }
  } catch {
    // Délai dépassé, appareil absent, réponse illisible : les messages bruts sont techniques et en anglais.
    throw noAnswer();
  } finally {
    clearTimeout(timer);
  }
}

/** Requête TCP courte (module natif). `replyBytes` : 0 = ne rien lire, -1 = jusqu'au saut de ligne. */
export async function tcp(ip: string, port: number, payload: number[] | string, replyBytes = 0, timeoutMs = 3000): Promise<number[]> {
  if (!native) throw new Error(t('L’appli ne sait pas encore allumer cet appareil.'));
  const bytes = typeof payload === 'string' ? [...unescape(encodeURIComponent(payload))].map((c) => c.charCodeAt(0)) : payload;
  try {
    return await native.tcpRequest(ip, port, bytes, replyBytes, timeoutMs);
  } catch {
    throw noAnswer();
  }
}

export const bytesToText = (bytes: number[]): string => String.fromCharCode(...bytes);

/** Envoie un datagramme UDP (sans attendre de réponse). */
export function udpSend(ip: string, port: number, payload: number[] | string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4' });
    socket.on('error', (e: Error) => {
      socket.close();
      reject(e);
    });
    socket.bind(0, () => {
      const data = typeof payload === 'string' ? payload : Buffer.from(payload);
      socket.send(data, undefined, undefined, port, ip, (err?: Error) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

/**
 * Lit un flux d'évènements (Server-Sent Events) pendant `ms`, puis coupe : sert à trouver le nom
 * des lumières d'un appareil ESPHome (`/events`). Renvoie le texte reçu.
 */
export function readEvents(url: string, ms = 2500): Promise<string> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let text = '';
    const done = (): void => {
      try {
        xhr.abort();
      } catch {
        // déjà fermé
      }
      resolve(text);
    };
    xhr.onprogress = () => {
      text = xhr.responseText;
    };
    xhr.onerror = done;
    xhr.onload = () => {
      text = xhr.responseText;
      done();
    };
    xhr.open('GET', url);
    xhr.send();
    setTimeout(done, ms);
  });
}
