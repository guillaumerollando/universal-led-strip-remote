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
