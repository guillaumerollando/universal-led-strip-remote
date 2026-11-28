import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import native from '../../modules/led-strip-native/src';
import { FAMILIES } from '../core/families';
import { lang, t } from '../i18n';
import { getDevices } from './store';
import { showDialog } from '../ui/Dialog';

/**
 * « Signaler un problème » (standard du studio) : mail déjà rempli à l'adresse du studio, avec ce qui aide à corriger
 * (version, Android, modèle, langue, écran, types de lumières) et rien de personnel.
 */
export const SUPPORT_MAIL = 'rollandostudio@gmail.com';

/** Ouvre l'appli de mail ; false s'il n'y en a pas (l'appelant montre alors l'adresse). */
export async function reportProblem(screen?: string): Promise<boolean> {
  const version = Constants.expoConfig?.version ?? '';
  const android = Platform.constants as { Release?: string; Brand?: string; Model?: string };
  const devices = getDevices();
  const lights = [...new Set(devices.map((d) => FAMILIES[d.family]?.label ?? d.family))].join(', ') || '—';
  const subject = `[Bug] Universal LED Strip Remote ${version}`;
  const body = [
    t('Décris ce qui s’est passé :'),
    '',
    '',
    '',
    '———',
    `Version : ${version}`,
    `Android : ${android.Release ?? Platform.Version}`,
    `${t('Appareil')} : ${[android.Brand, android.Model].filter(Boolean).join(' ')}`,
    `${t('Langue')} : ${lang}`,
    ...(screen ? [`${t('Écran')} : ${screen}`] : []),
    `${t('Lumières')} : ${devices.length} (${lights})`,
  ].join('\n');
  const url = `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return Linking.openURL(url).then(
    () => true,
    () => false,
  );
}

let asking = false;

/**
 * Secouer le téléphone = signaler un problème (standard du studio, toutes les applis). Une petite question d'abord :
 * une secousse peut venir d'une poche ou d'un sac. `screen()` dit sur quel écran on était.
 */
export function listenForShake(screen: () => string): () => void {
  const sub = native?.addListener?.('onShake', () => {
    if (asking) return;
    asking = true;
    showDialog(
      t('Signaler un problème ?'),
      t('Tu as secoué le téléphone. Dis-nous ce qui ne va pas, on lit tout et on répond.'),
      [
        { text: t('Annuler'), style: 'cancel', onPress: () => void (asking = false) },
        {
          text: t('Signaler'),
          onPress: () => {
            asking = false;
            void reportProblem(screen()).then((ok) => ok || showDialog(t('Signaler un problème'), t('Aucune appli de mail trouvée : écris-nous à {mail}', { mail: SUPPORT_MAIL })));
          },
        },
      ],
    );
  });
  return () => sub?.remove();
}
