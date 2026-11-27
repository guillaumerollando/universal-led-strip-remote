import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Rgb } from '../core/elk';
import {
  answerHalving,
  burstPlan,
  leadsFrom,
  setupForUnknown,
  startHalving,
  suspectBursts,
  verifySteps,
  type BurstWindow,
  type Halving,
  type IrCandidate,
  type IrSetup,
  type StripState,
} from '../core/irSetup';
import { hasIrEmitter, irAimHint, sendIrBatch } from '../services/ir';
import { saveDevice } from '../services/store';
import { AddForm } from '../ui/AddForm';
import { Button, Muted, Screen, styles } from '../ui/kit';
import { LedRow, type LedMode } from '../ui/LedRow';
import { LightStrip } from '../ui/light';
import { defaultName } from '../ui/labels';
import { colors, radius, space, WARM_WHITE } from '../ui/theme';
import { t } from '../i18n';

type Phase =
  | { kind: 'state' }
  | { kind: 'bursting' }
  | { kind: 'refining'; lead: number; leads: number; expected?: Rgb }
  | { kind: 'reset'; halving: Halving }
  | { kind: 'halvingWait' }
  | { kind: 'done'; setup: IrSetup; rgb?: Rgb }
  | { kind: 'none' };

/** Silence réglementaire après une rafale : sans lui, le récepteur mélange la fin d'une rafale et le début de la suivante. */
const GAP_MS = 60;
const STEP_MS = 650;
const WAIT_MS = 1600;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Ajout d'un ruban à télécommande.
 * 1. Allumé ou éteint ? (deux grandes moitiés d'écran)
 * 2. Rafales rapides, adaptées à l'état ; on touche l'écran — n'importe où — dès que le ruban réagit.
 * 3. Affinage ensemble : les pistes possibles sont rejouées une par une, une tape désigne la bonne.
 */
export default function IrWizard() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: 'state' });
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  /** Une tape vient d'être prise en compte (affiche « Bien reçu ! » jusqu'à l'étape suivante). */
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);

  const run = useRef(0);
  const tapped = useRef<number | null>(null);
  const state = useRef<StripState>('on');
  const bursts = useRef<IrCandidate[][]>([]);
  const windows = useRef<BurstWindow[]>([]);

  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  useEffect(() => {
    setAck(false);
  }, [phase.kind, phase.kind === 'refining' ? phase.lead : 0]);

  const fail = (e: unknown): void => {
    setError((e as Error).message);
    setPhase({ kind: 'state' });
  };

  /** Attend une tape pendant `ms` ; renvoie true si l'utilisateur a touché l'écran. */
  const waitTap = async (me: number, ms: number): Promise<boolean> => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (run.current !== me) return false;
      if (tapped.current !== null) return true;
      await sleep(40);
    }
    return tapped.current !== null;
  };

  // ── 2. Rafales ──
  const burst = async (from: number): Promise<void> => {
    const me = ++run.current;
    tapped.current = null;
    windows.current = [];
    setPhase({ kind: 'bursting' });
    const plan = bursts.current;
    for (let b = from; b < plan.length; b++) {
      if (run.current !== me) return;
      setProgress(b / plan.length);
      const start = Date.now();
      try {
        await sendIrBatch(plan[b]);
      } catch (e) {
        fail(e);
        return;
      }
      await sleep(GAP_MS);
      windows.current.push({ index: b, start, end: Date.now() });
      if (tapped.current !== null) break;
    }
    if (run.current !== me) return;
    // Petite marge pour une tape juste après la dernière rafale.
    if (tapped.current === null && !(await waitTap(me, 1200))) {
      setPhase({ kind: 'none' });
      return;
    }
    void refine(tapped.current!);
  };

  // ── 3. Affinage ──
  const refine = async (tapAt: number): Promise<void> => {
    const me = ++run.current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const suspectIdx = suspectBursts(windows.current, tapAt);
    const suspects = suspectIdx.flatMap((i) => bursts.current[i]);
    const leads = leadsFrom(suspects);
    const families = leads.filter((l) => l.kind === 'family');
    for (let i = 0; i < families.length; i++) {
      const lead = families[i];
      if (lead.kind !== 'family' || run.current !== me) return;
      tapped.current = null;
      const steps = verifySteps(lead.family, state.current === 'on');
      const expected = steps.find((s) => s.rgb)?.rgb;
      setPhase({ kind: 'refining', lead: i + 1, leads: families.length, expected });
      await sleep(300);
      for (const step of steps) {
        if (run.current !== me) return;
        await sendIrBatch([step.code]).catch(() => undefined);
        if (await waitTap(me, STEP_MS)) return accept(lead.family.setup, expected);
      }
      if (await waitTap(me, WAIT_MS)) return accept(lead.family.setup, expected);
    }
    const unknown = leads.find((l) => l.kind === 'codes');
    if (unknown && unknown.kind === 'codes') {
      setPhase({ kind: 'reset', halving: startHalving(unknown.codes) });
      return;
    }
    // Aucune piste ne colle : on reprend les rafales juste après.
    void burst(Math.max(...suspectIdx) + 1);
  };

  /** Codes inconnus : réduction par moitiés, l'utilisateur remet le ruban comme au départ entre deux manches. */
  const playHalf = async (h: Halving): Promise<void> => {
    const me = ++run.current;
    tapped.current = null;
    setPhase({ kind: 'halvingWait' });
    await sendIrBatch(h.testing.slice(0, 16)).catch(() => undefined);
    const reacted = await waitTap(me, WAIT_MS);
    if (run.current !== me) return;
    const r = answerHalving(h, reacted);
    if (!r) setPhase({ kind: 'none' });
    else if ('command' in r) accept(setupForUnknown(r));
    else setPhase({ kind: 'reset', halving: r });
  };

  const accept = (setup: IrSetup, rgb?: Rgb): void => {
    run.current++;
    setName((n) => n || defaultName());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase({ kind: 'done', setup, rgb });
  };

  const start = (s: StripState): void => {
    setError(null);
    state.current = s;
    bursts.current = burstPlan(s);
    void burst(0);
  };

  /** Une tape n'importe où : prise en compte tout de suite (vibration + « Bien reçu ! »). */
  const onTap = (): void => {
    if (phase.kind === 'none') setPhase({ kind: 'state' });
    else if (phase.kind === 'reset') void playHalf(phase.halving);
    else if (tapped.current === null) {
      tapped.current = Date.now();
      setAck(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  const save = (): void => {
    if (phase.kind !== 'done' || !name.trim() || saving) return;
    setSaving(true);
    // Le ruban est enregistré en mémoire tout de suite ; l'écriture sur le téléphone suit en arrière-plan.
    void saveDevice({
      key: `ir:${Date.now()}`,
      name: name.trim(),
      family: 'ir-nec',
      transport: 'ir',
      rawName: 'Infrarouge',
      address: 'ir',
      ir: phase.setup,
      roomId,
      state: { on: true, rgb: phase.rgb },
      addedAt: Date.now(),
    });
    router.dismissAll();
  };

  if (!hasIrEmitter()) {
    return (
      <Screen>
        <Text style={styles.big}>{t('Pas d’infrarouge')}</Text>
        <Muted>{t('Ce téléphone n’a pas d’émetteur infrarouge : il ne peut pas remplacer une télécommande.')}</Muted>
        <Button label={t('Retour')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const close = (
    <View style={{ paddingHorizontal: space.lg, paddingTop: insets.top + space.md }}>
      <Pressable accessibilityLabel={t('Fermer')} hitSlop={16} onPress={() => router.back()} style={{ alignSelf: 'flex-start' }}>
        <Text style={[styles.title, { color: colors.textDim, fontSize: 26 }]}>✕</Text>
      </Pressable>
    </View>
  );

  // ── Écrans ──
  if (phase.kind === 'state') {
    return (
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        {close}
        <View style={{ paddingHorizontal: space.xl, paddingVertical: space.lg, gap: space.sm }}>
          <Text style={[styles.big, { textAlign: 'center' }]}>{t('Ajouter un ruban à télécommande')}</Text>
          <Text style={[styles.muted, { textAlign: 'center', fontSize: 15, lineHeight: 22 }]}>
            {irAimHint()} {t('Ton ruban est…')}
          </Text>
          {error && <Text style={[styles.muted, { color: colors.warn, textAlign: 'center' }]}>{error}</Text>}
        </View>
        <StateHalf label={t('Allumé')} on onPress={() => start('on')} />
        <StateHalf label={t('Éteint')} on={false} onPress={() => start('off')} />
      </View>
    );
  }

  if (phase.kind === 'done') {
    return (
      <AddForm
        name={name}
        onName={setName}
        roomId={roomId}
        onRoom={setRoomId}
        onSave={save}
        saving={saving}
        top={
          <>
            <LedRow mode="lit" rgb={phase.rgb ?? WARM_WHITE} count={9} size={18} />
            <Text style={[styles.big, { textAlign: 'center' }]}>{t('C’est trouvé !')}</Text>
          </>
        }
      />
    );
  }

  const led: LedMode = phase.kind === 'bursting' || phase.kind === 'halvingWait' ? 'chase' : phase.kind === 'none' ? 'off' : 'breathe';
  const [title, hint] =
    phase.kind === 'bursting'
      ? [t('Touche l’écran dès que ton ruban réagit'), t('Couleur, allumage, extinction : n’importe quel changement.')]
      : phase.kind === 'refining'
        ? [t('Affinage — piste {lead} sur {leads}', { lead: phase.lead, leads: phase.leads }), t('Touche l’écran si ton ruban réagit maintenant.')]
        : phase.kind === 'reset'
          ? [
              t('Encore un petit tour'),
              state.current === 'on'
                ? t('Remets ton ruban allumé comme au début, puis touche l’écran.')
                : t('Remets ton ruban éteint comme au début, puis touche l’écran.'),
            ]
          : phase.kind === 'halvingWait'
            ? [t('Il a réagi ?'), t('Touche l’écran si oui.')]
            : [t('Je n’ai rien trouvé'), `${irAimHint()} ${t('Touche l’écran pour recommencer.')}`];

  return (
    // Tout l'écran est le bouton (seul le ✕ a son propre geste) : on regarde le ruban, pas le téléphone.
    <Pressable onPressIn={onTap} style={[styles.screen, { paddingBottom: insets.bottom + space.lg }]}>
      {close}
      <View pointerEvents="none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: space.xl, gap: space.xl }}>
        <LedRow mode={led} rgb={phase.kind === 'refining' && phase.expected ? phase.expected : undefined} count={9} size={26} />
        {phase.kind === 'bursting' && (
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: colors.accent }} />
          </View>
        )}
        <View style={{ gap: space.sm }}>
          <Text style={[styles.big, { textAlign: 'center', fontSize: 26, color: ack ? colors.accent : colors.text }]}>{ack ? t('Bien reçu !') : title}</Text>
          <Text style={[styles.muted, { textAlign: 'center', fontSize: 15, lineHeight: 22 }]}>{ack ? t('Je vérifie…') : hint}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Une moitié d'écran pour dire l'état du ruban : facile à toucher sans viser. */
function StateHalf({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        marginHorizontal: space.lg,
        marginBottom: space.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
        justifyContent: 'center',
        paddingHorizontal: space.xl,
        gap: space.md,
        overflow: 'hidden',
      })}
    >
      <Text style={[styles.big, { textAlign: 'center', fontSize: 30 }]}>{label}</Text>
      <LightStrip on={on} height={10} />
    </Pressable>
  );
}
