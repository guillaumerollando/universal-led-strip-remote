import { describe, expect, it } from 'vitest';

import { classifyProbe } from '../probe';
import {
  decodeMotif,
  encodeMotif,
  isOpenBeken,
  normalizeMotif,
  obkAnimCommands,
  obkAnimSpeed,
  obkDrivers,
  obkFileNames,
  obkPixelCount,
  withStartupEffect,
} from '../protocols/openbeken';
import { parseTasmotaStatus } from '../protocols/wifi';
import { obkAnimStartup, OBK_BEFORE_SCRIPT, OBK_LAUNCH_SCRIPT, OBK_STARTUP_SCRIPT } from '../protocols/openbeken';
import status0 from './fixtures/openbeken-status0.json';


// Réponses réelles du ruban LSC de Guillaume (OpenBeken 1.18.219, 2026-11-27).
const STATE_HTML =
  '<h5>LED Animation [ACTIVE]</h5> DDP received: 0 packets <h5>3 drivers active (PixelAnim, SM16703P, DDP), total: 31</h5>';
const AUTOEXEC = 'startDriver SM16703P\nSM16703P_Init 200 BRG\n';

describe('OpenBeken', () => {
  it('se reconnaît à sa version dans « Status 0 »', () => {
    expect(isOpenBeken(status0)).toBe(true);
    expect(isOpenBeken({ StatusFWR: { Version: '13.2.0(tasmota)' } })).toBe(false);
    expect(isOpenBeken(null)).toBe(false);
  });

  it('reste lisible par le pilote Tasmota', () => {
    expect(parseTasmotaStatus(status0)).toEqual({ name: 'obkE187799A', color: true, ct: true });
  });

  it('ajout par adresse IP : famille openbeken', () => {
    expect(classifyProbe('192.168.1.78', { tasmota: status0 })).toMatchObject({ family: 'openbeken', key: 'wifi:openbeken:C4:82:E1:87:79:9A' });
  });

  it('lit la liste des fichiers du ruban', () => {
    const listing = {
      dir: '',
      content: [
        { name: '.', type: 2, size: 0 },
        { name: 'autoexec.bat', type: 1, size: 43 },
        { name: 'ledstrip-motif.txt', type: 1, size: 3875 },
      ],
    };
    expect(obkFileNames(listing)).toEqual(['autoexec.bat', 'ledstrip-motif.txt']);
    expect(obkFileNames('pas du JSON')).toEqual([]);
  });

  it('lit les pilotes actifs et le nombre de LED', () => {
    expect(obkDrivers(STATE_HTML)).toEqual(['PixelAnim', 'SM16703P', 'DDP']);
    expect(obkDrivers('rien')).toEqual([]);
    expect(obkPixelCount(AUTOEXEC)).toBe(200);
    expect(obkPixelCount('startDriver SM16703P')).toBeUndefined();
  });

  it('animations : vitesse inversée (0 = le plus rapide)', () => {
    expect(obkAnimSpeed(100)).toBe(0);
    expect(obkAnimSpeed(55)).toBe(5);
    expect(obkAnimSpeed(0)).toBe(10);
    // Le ruban doit être allumé, sinon l'animation n'affiche rien ; la couleur avant l'animation qui la prend.
    expect(obkAnimCommands(3, 90, { r: 255, g: 45, b: 0 })).toEqual([
      'stopAllScripts',
      'loglevel 1',
      'startDriver PixelAnim',
      'Power On',
      'Color FF2D00',
      'AnimSpeed 1',
      'Anim 3',
    ]);
    // Au démarrage, l'animation part 5 s après (sinon l'envoi aux LED se bloque).
    expect(obkAnimStartup(1, 50)).toEqual(['loglevel 1', 'startDriver PixelAnim', 'Power On', 'AnimSpeed 5', 'addRepeatingEvent 5 1 Anim 1']);
  });

  it('avant un script : cache vidé, animation intégrée coupée, jamais « allumer » (flash blanc) ; au démarrage : lancé 5 s après', () => {
    expect(OBK_BEFORE_SCRIPT).toEqual(['resetSVM', 'stopDriver PixelAnim', 'loglevel 1']);
    expect(OBK_BEFORE_SCRIPT).not.toContain('Power On');
    expect(OBK_LAUNCH_SCRIPT).toEqual(['Color 000000', 'startScript ledstrip-motif.txt * 7']);
    expect(OBK_STARTUP_SCRIPT).toEqual(['loglevel 1', 'addRepeatingEvent 5 1 startScript ledstrip-motif.txt * 7']);
  });

  it('motif : enregistré en texte et relu', () => {
    expect(encodeMotif({ mode: 'snake', pixels: [{ r: 255, g: 0, b: 16 }] })).toBe('ff0010');
    expect(encodeMotif({ mode: 'flow', pixels: [{ r: 0, g: 0, b: 0 }] })).toBe('*000000');
    expect(decodeMotif('=00ff00')).toEqual({ mode: 'still', pixels: [{ r: 0, g: 255, b: 0 }] });
    // Ambiances enregistrées avant les trois modes.
    expect(normalizeMotif({ repeat: true, pixels: [] })).toEqual({ mode: 'flow', pixels: [] });
    expect(normalizeMotif({ repeat: false, pixels: [] })).toEqual({ mode: 'snake', pixels: [] });
    const m = { mode: 'flow' as const, pixels: [{ r: 1, g: 2, b: 3 }] };
    expect(decodeMotif(encodeMotif(m))).toEqual(m);
    expect(decodeMotif('')).toBeUndefined();
    expect(decodeMotif('zz,00ff00')).toEqual({ mode: 'snake', pixels: [{ r: 0, g: 255, b: 0 }] });
  });

  it("démarrage : garde les lignes du propriétaire, remplace seulement le bloc de l'appli", () => {
    const once = withStartupEffect(AUTOEXEC, ['startDriver PixelAnim', 'Anim 0']);
    expect(once).toBe(
      'startDriver SM16703P\nSM16703P_Init 200 BRG\n// ledstrip-remote: début\nstartDriver PixelAnim\nAnim 0\n// ledstrip-remote: fin\n',
    );
    const twice = withStartupEffect(once, ['startScript ledstrip-motif.txt * 7']);
    expect(twice).toBe(
      'startDriver SM16703P\nSM16703P_Init 200 BRG\n// ledstrip-remote: début\nstartScript ledstrip-motif.txt * 7\n// ledstrip-remote: fin\n',
    );
    expect(withStartupEffect(twice, [])).toBe(AUTOEXEC);
  });
});
