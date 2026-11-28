import native from '../../modules/led-strip-native/src';
import { t } from '../i18n';
import { showDialog } from '../ui/Dialog';

/**
 * Pose un widget « Pièce » ou « Ambiance » sur l'écran d'accueil : Android demande confirmation. Si le lanceur ne
 * sait pas le faire d'ici, on explique le chemin à la main.
 */
export function pinWidget(kind: 'room' | 'ambiance', roomId: string, sceneId = ''): void {
  const ok = native?.pinWidget?.(kind, roomId, sceneId) ?? false;
  if (!ok) {
    showDialog(
      t('Ajouter à l’écran d’accueil'),
      t('Ton téléphone ne permet pas de le poser d’ici : appui long sur l’écran d’accueil, puis Widgets, puis l’appli.'),
    );
  }
}
