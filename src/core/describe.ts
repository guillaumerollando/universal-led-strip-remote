/**
 * Ce qu'on montre d'un appareil trouvé : le nom du produit quand il dit quelque chose à l'utilisateur
 * (« Govee H6159 », « Nanoleaf Shapes », « Hue lightstrip plus »), jamais un nom de puce (« ELK-BLEDOM »).
 */
import { FAMILIES } from './families';
import type { DetectedDevice } from './identify';
import { nanoleafModelName, shellyModelName } from './protocols/wifi';
import { yeelightModelName } from './protocols/udp';

type Describable = Pick<DetectedDevice, 'family' | 'rawName' | 'model'> & { meta?: Record<string, string> };

/** Nom du produit (marque + modèle), ou undefined pour un contrôleur sans marque. */
export function productName(d: Describable): string | undefined {
  const brand = FAMILIES[d.family]?.brand;
  switch (d.family) {
    case 'govee':
    case 'govee-lan': {
      const sku = d.model ?? /(?:^|[^a-z0-9])(H\d{4})/i.exec(d.rawName)?.[1];
      return sku ? `Govee ${sku.toUpperCase()}` : 'Govee';
    }
    case 'hue':
      return d.meta?.product ? (/^hue\b/i.test(d.meta.product) ? `Philips ${d.meta.product}` : d.meta.product) : 'Philips Hue';
    case 'nanoleaf':
      return nanoleafModelName(d.model);
    case 'yeelight':
      return yeelightModelName(d.model ?? '');
    case 'shelly':
      return shellyModelName(d.model ?? '');
    case 'elgato':
      return d.model || 'Elgato';
    default:
      return brand;
  }
}

/**
 * Pour un contrôleur sans marque : ce qu'il pilote, en mots simples (clé française passée à `t()`),
 * ou undefined quand on ne sait rien de plus que « ruban ».
 */
export function stripKind(d: Describable): 'Ruban à pixels' | undefined {
  return d.family === 'sp110e' || (d.family === 'openbeken' && !!d.meta?.pixels) ? 'Ruban à pixels' : undefined;
}

/** Le nom propre de l'appareil s'il en a un (donné par son propriétaire dans son appli : « Salon », « WLED-Bureau »). */
export function ownName(d: Describable): string | undefined {
  const n = d.rawName.replace(/\s+/g, ' ').trim();
  if (!n || n === productName(d)) return undefined;
  return n;
}

/** Ce qu'est la lumière : un ruban, une ampoule, ou une autre lumière (panneau, lampe…), pour les bons mots. */
export type LightKind = 'strip' | 'bulb' | 'light';

/**
 * Ruban, ampoule ou autre lumière, d'après la famille et le modèle connus. Dans le doute pour une famille qui fait
 * les deux, « lumière » (jamais « ruban » pour une ampoule).
 */
export function lightKind(d: Describable & { transport?: string }): LightKind {
  const model = `${d.model ?? ''} ${d.meta?.product ?? ''} ${d.rawName}`.toLowerCase();
  const stripLike = /strip|stripe|ruban|band|tape|lightstrip/.test(model);
  switch (d.family) {
    case 'yeelight':
      return /stripe|strip/.test(d.model ?? '') ? 'strip' : /color|colorc|mono|ct/.test(d.model ?? '') ? 'bulb' : 'light';
    case 'lifx':
      return stripLike || /\bz\b|beam/.test(model) ? 'strip' : 'bulb';
    case 'hue':
      return stripLike ? 'strip' : /play|bar|go|iris|signe|gradient|lamp|lampe/.test(model) ? 'light' : 'bulb';
    case 'hue-ble':
      return stripLike ? 'strip' : 'bulb';
    case 'shelly':
      return /SHCB-1|SHBLB-1|bulb/i.test(d.model ?? '') ? 'bulb' : 'strip';
    case 'elgato':
      return stripLike ? 'strip' : 'light';
    case 'nanoleaf':
    case 'esphome':
      return 'light';
    case 'govee':
    case 'govee-lan':
      // Ampoules Govee : H6003, H6004, H6008, H6009… (H60xx en dessous de H6050).
      return /h60[0-4]\d/.test(model) ? 'bulb' : stripLike || /h6\d{3}|h61\d{2}/.test(model) ? 'strip' : 'light';
    case 'openbeken':
    case 'tasmota':
      return d.meta?.pixels ? 'strip' : /bulb|ampoule|lamp/.test(model) ? 'bulb' : stripLike ? 'strip' : 'light';
    case 'magichome-wifi':
      return /bulb|ampoule/.test(model) ? 'bulb' : 'strip';
    default:
      return 'strip';
  }
}
