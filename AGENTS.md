# AGENTS.md — Rubanix (« Universal LED Strip Remote »)

Guide de référence pour tout agent IA (Claude Code, Codex…). À lire **en priorité** avant chaque session.
`CLAUDE.md` importe ce fichier : **ce fichier fait foi**. Conversation et documentation en français.

## Projet

**Rubanix** (nom de code ; publié sous « **Universal LED Strip Remote** », « Télécommande Ruban LED » en français,
« LED Strip Remote » sous l'icône — ADR-009) : une seule appli Android pour tous les rubans LED d'AliExpress. Chaque contrôleur chinois a sa propre
appli (duoCo Strip, Lotus Lamp, HappyLighting, Magic Home, Smart Life…) et on ne sait plus laquelle va avec quel ruban.
Rubanix scanne le Bluetooth et le Wi-Fi, reconnaît la famille du contrôleur, dit quelle appli d'origine l'accompagne,
et pilote directement ce qu'il sait piloter (ELK-BLEDOM en Bluetooth, rubans infrarouges via l'émetteur IR du téléphone).

**Cap (Guillaume, 2026-10-08)** : une appli simple et rapide qui ne s'appuie que sur des protocoles **ouverts**. Jamais de
lien avec un compte ou une appli d'origine (Smart Life…), jamais de kit propriétaire : un système fermé (Tuya) reçoit juste
un lien vers son appli et l'astuce « ajoute-le en infrarouge ».

Usage perso d'abord, Play Store ensuite. Android seulement (iOS cache les adresses Bluetooth et bride le réseau local).

## Où trouver quoi

- Vault Obsidian : `~/Dev/Gestion de projet/Rubanix/` — lire son `CLAUDE.md`, `00-vision/vision.md`,
  `03-technique/decisions.md` et `01-sprints/kanban.md` avant de commencer
- `src/core/` : **TypeScript pur, sans React Native**, testé avec Vitest. Toute la connaissance des protocoles vit ici
  - `families.ts` : familles de contrôleurs, applis d'origine, capacités
  - `identify.ts` : nom Bluetooth / réponse Wi-Fi → famille (`identifyBle`, `parseMagicHomeReply`, `parseGoveeReply`…)
  - `elk.ts` : trames ELK-BLEDOM (variantes `elk`, `bledob`, `melk`), effets et vitesse
  - `color.ts` : conversions teinte / RVB (barres arc-en-ciel)
  - `tuya/` : lecture des annonces UDP Tuya, pour **reconnaître** ces appareils (Rubanix ne pilote pas Tuya : système fermé)
  - `irSetup.ts` : **assistant d'ajout infrarouge** — `burstPlan(état)` (rafales de 16 codes avec silences, adaptées à
    l'état allumé / éteint), `suspectBursts`, `leadsFrom` (pistes), `verifySteps`, réduction par moitiés, `remoteFromSetup`
  - `ir.ts` : encodage NEC et 7 télécommandes (24 / 44 touches, et 5 autres connues seulement pour marche/arrêt)
- `src/services/` : accès au matériel — `ble.ts` (react-native-ble-plx), `lan.ts` (react-native-udp), `ir.ts`,
  `scan.ts` (état du scan), `store.ts` (appareils enregistrés, AsyncStorage)
- `src/app/` : écrans Expo Router — `index` (pièces et rubans), `add` (recherche Bluetooth / Wi-Fi), `device/[key]` (fiche :
  marche/arrêt, couleurs, effets, pièce, nom), `room/[id]` (créer / modifier une pièce), `ir-new` (**assistant plein écran** d'ajout d'un
  ruban à télécommande), `power` (lien profond), `dev-seed`
- `src/services/control.ts` : **une seule porte d'entrée** pour piloter un ruban quelle que soit sa famille (`setPower`,
  `setColor`, `setEffect`, `setGroupPower`…) ; retient l'état envoyé (ces contrôleurs ne le renvoient pas)
- `src/i18n/` : `t()` et la langue (`expo-localization`), `en.ts` (traductions anglaises indexées par le texte français)
- `src/ui/` : `theme.ts` (DA « la lumière d'abord »), `kit.tsx` (Screen avec clavier, Button, Card…), `light.tsx` (Glow,
  LightStrip, PowerButton, SignatureStrip, Swatch, Chip), `DeviceTile`, `RoomSection`, `RoomPicker`, `ElkControls`, `EffectsPanel`, `IrControls` (fiche infrarouge dans le
  style Bluetooth), `LedRow` (LED illuminées à la fin de l'ajout)
- `modules/rubanix-native/` : module Expo local en Kotlin — émetteur infrarouge (`ConsumerIrManager`) et verrou
  multicast Wi-Fi. Autolinké ; `null` hors Android

## Commandes

```bash
pnpm install
pnpm test                    # tests Vitest de src/core
pnpm check-types             # tsc --noEmit
pnpm prebuild                # régénère android/ (jamais modifié à la main)
pnpm android                 # build + installe le dev build sur le téléphone / l'émulateur
pnpm start                   # Metro pour le dev build
cd android && ./gradlew assembleDebug   # dev build (a besoin de Metro) : android/app/build/outputs/apk/debug/app-debug.apk
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && cp app/build/outputs/apk/release/app-release.apk ../export/Rubanix.apk   # APK autonome pour le téléphone (signé avec la clé de debug)
```

## Règles

- **Infrarouge (émetteur MediaTek IRTX du Redmi de Guillaume)** : la fin d'un motif peut être tronquée par le pilote. Chaque
  envoi se fait en UN appel et se termine par une queue de « touche maintenue » (`withTail` : `pressPattern`, `burstPattern`).
  Jamais une trame seule sans queue ; rafales de 15 codes max (limite Android de 2 s)
- **Aucun jargon pour l'utilisateur** (Guillaume, 2026-10-08) : jamais de nom de télécommande (« 24 / 44 touches »), de
  fréquence, de protocole ou de famille de contrôleur à l'écran. L'utilisateur veut que ça marche, vite, automatiquement
- Dans l'interface, ne jamais écrire « Rubanix » : dire « l'appli » (nom sous l'icône : « LED Strip Remote », « Ruban LED »
  sur un téléphone en français — `locales/fr.json`)
- **Traduction** : français si le téléphone est en français, anglais sinon. Tout texte affiché passe par
  `t('texte en français', { variables })` (`src/i18n`) et sa traduction va dans `src/i18n/en.ts` ; le test
  `src/i18n/__tests__/en.test.ts` échoue s'il en manque une. Les libellés de `src/core` (effets, couleurs) se traduisent à
  l'affichage : `t(effet.label)`
- Après un ajout de ruban : retour à l'accueil (`router.dismissAll()`), avec choix de la pièce pendant l'ajout

- Expo SDK 57 : vérifier la doc versionnée (`https://docs.expo.dev/versions/v57.0.0/`), ne pas se fier à sa mémoire
- `android/` est généré (CNG) : on configure par `app.json` et les plugins, jamais à la main
- Nouvelle famille ou nouveau protocole : d'abord `src/core` + un test avec un vrai nom ou une vraie trame, puis le service
- Tout protocole non vérifié sur un vrai appareil est marqué « à confirmer » (commentaire + vault `03-technique/protocoles.md`)
- Paquet natif : vérifier la compatibilité New Architecture sur reactnative.directory
- Une seule connexion Bluetooth à la fois sur ces contrôleurs : toujours libérer la connexion (`ble.ts` coupe après 20 s)
- Pas de backend, pas de compte, pas de collecte : tout reste sur le téléphone
- Pas de commit sans demande explicite de Guillaume

## Tester sans téléphone

- **Pas d'émulateur sans l'accord de Guillaume** (2026-10-08 : la RAM sature et les sessions Kipo plantent). Tester sur son
  téléphone (`adb -d`) quand il est branché, sinon Vitest et les sondes `tools/`
- Émulateur dédié, seulement si Guillaume l'accepte : AVD `rubanix` (`emulator -avd rubanix -port 5560`), Metro sur le port 8088 (`adb -s emulator-5560 reverse tcp:8088 tcp:8088`).
  Ne jamais toucher aux émulateurs `tiiz-*` / `contrechamp*` (autres sessions) : toujours `adb -s emulator-5560`
- Lancer Metro **sans** `CI=1` (`npx expo start --dev-client --port 8088 < /dev/null`) : en mode CI, Metro ne surveille pas
  les fichiers et l'appli garde l'ancienne version
- En développement, sur un appareil sans émetteur infrarouge (émulateur), l'émission est **simulée** (`services/ir.ts`)
  pour pouvoir parcourir l'assistant ; jamais dans l'APK publié
- `rubanix://dev-seed` (développement seulement) : remplit l'appli d'une pièce « Salon » et de rubans allumés en couleur,
  pour voir l'interface sur l'émulateur
- Liens profonds : `rubanix://power?room=Salon&on=1`, `rubanix://power?device=<nom>&on=0`, `rubanix://power?all=1&on=0`

- L'émulateur Android n'a ni vrai Bluetooth ni émetteur infrarouge, et son réseau est isolé (NAT) : il ne sert qu'à
  l'interface. Les protocoles se vérifient avec `src/core` (Vitest) et avec les sondes Python de `tools/`
  depuis le PC, sur le même Wi-Fi que les rubans
- `python3 tools/make_icon.py [échantillons]` : régénère l'icône dans `assets/` — néon LED photoréaliste rendu par Blender
  (`tools/icon_blender.py`, Cycles GPU, `blender` dans le PATH) puis halo et teinte de nuit (Pillow), et l'écran de démarrage
  (`splash-icon.png`, plugin `expo-splash-screen`, fond `#0A0B0F`) ; ensuite `pnpm prebuild`
- `tools/probe_lan.py` : cherche Magic Home, Tuya, Govee, mDNS, SSDP sur le réseau
- `tools/ble_onoff.py <adresse> elk|melk` : éteint 4 s puis rallume un ruban ELK (venv avec `bleak`)
