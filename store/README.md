# Publication sur Google Play

Tout ce qu'il faut pour la fiche Play Store de **Universal LED Strip Remote** (« Télécommande Ruban LED » en français).

## Contenu de ce dossier

- `metadata/android/<langue>/` : titre (≤ 30 car.), description courte (≤ 80) et longue (≤ 4000) par langue, au format
  fastlane `supply` (`title.txt`, `short_description.txt`, `full_description.txt`). Référence : `fr-FR` et `en-US` ;
  les autres sont traduites depuis `en-US`
- `icon-512.png` : icône haute résolution (512 × 512) ; `feature-graphic.png` : bannière (1024 × 500), sans texte.
  Régénérées par `python3 tools/make_icon.py`
- Pages légales : dans le site public `~/Dev/site/led-strip-remote/` →
  https://guillaumerollando.github.io/led-strip-remote/privacy (URL pour la Console)
- Plan de publication et réponses aux formulaires : vault `Rubanix/06-publication/` (skill `publier-sur-le-play-store`)

## Réglages de la console Play

- **Catégorie** : Outils (Tools) — ou Maison et jardin (House & Home). Tags : smart home, LED, remote
- **Gratuite**, sans pub, sans achats intégrés
- **Sécurité des données** : aucune donnée collectée, aucune donnée partagée (pas de SDK tiers, pas de serveur).
  Chiffrement en transit : sans objet. Suppression : les données locales partent avec la désinstallation
- **Autorisations sensibles** : localisation seulement sur Android ≤ 11 (`maxSdkVersion 30`, obligatoire pour le scan
  Bluetooth), jamais en arrière-plan → pas de déclaration de localisation en arrière-plan
- **Classification du contenu** : questionnaire IARC → tout public (aucun contenu sensible, pas d'interaction entre utilisateurs)
- **Public cible** : 13 ans et plus (pas une appli pour enfants)
- **Annonces** : non
- **Application gouvernementale / financière / santé** : non

## Encore à faire avant la publication

1. ~~Pages légales en ligne~~ (fait le 2026-10-09)
2. ~~Identifiant `com.rollandostudio.ledstripremote`~~ (2026-10-09)
3. ~~Clé d'envoi (`~/Dev/Utils/keystore/led-strip-remote-upload.jks` + `.env`, à sauvegarder hors de l'ordi) et AAB signé
   `export/LedStripRemote-1.0.0.aab`~~ (2026-10-09) ; Play App Signing à activer à la création de l'appli
4. Captures d'écran (au moins 2, idéalement 4 à 8, format téléphone) : accueil avec pièces, fiche Bluetooth (couleurs,
   effets), assistant infrarouge, recherche
5. Compte développeur personnel récent : **test fermé obligatoire** (12 testeurs pendant 14 jours) avant la production
