# LeSacAUrge

![Logo](icons/icon-192.png)

Application web installable (PWA) pour téléphone et ordinateur : saisie au clavier
ou par la dictée vocale du clavier des paragraphes d'une observation d'urgence, puis
copie en **texte brut** d'un clic dans le logiciel d'observation.

©2026 LESACA Julien Tous droits réservés.

## Fonctions

- Encarts : Motif (masquable), Anamnèse, Antécédents médicaux, Antécédents chirurgicaux,
  Traitements habituels, Allergies, Examen clinique, Hypothèses diagnostiques,
  Conduite à tenir, Évolution, Conclusion.
- Un bouton **Copier** par encart + **Tout copier** (Ctrl+Maj+C) ; raccourcis Alt+1 à Alt+9.
- Copie en texte brut : guillemets typographiques, tirets longs, points de suspension,
  espaces insécables, puces et émojis normalisés ou supprimés ; œ devient oe.
  Option « compatibilité stricte » qui retire aussi les accents.
- Pastilles préremplies (ATCD, allergies, traitements, hypothèses, CAT, évolution,
  conclusion), activables/désactivables d'un toucher, personnalisables dans les réglages.
- Examen clinique : case « examen normal complet » ou sélection par appareil
  (neurologique, hémodynamique, pulmonaire, cardiovasculaire, abdominal, ganglionnaire,
  cutané), saisie des constantes insérées en une ligne.
- Plusieurs dossiers simultanés (libellé non identifiant, ex. « Box 4 »), horodatage
  dans l'évolution, suppression automatique des dossiers inactifs (12 h, 24 h, 3 j).
- Fonctionne hors ligne, thème clair/sombre, installable sur l'écran d'accueil.
- Synchronisation téléphone et ordinateur, **chiffrée de bout en bout**.

## Installation (hébergement GitHub Pages)

1. Fusionner la branche dans `main`.
2. GitHub : Settings > Pages > Source : **GitHub Actions**. Le workflow
   `.github/workflows/pages.yml` publie le site à chaque push sur `main`.
   (GitHub Pages sur un dépôt privé nécessite un abonnement payant GitHub.)
3. Ouvrir l'adresse publiée ; sur téléphone : Partager > « Sur l'écran d'accueil »
   (iPhone) ou menu > « Installer l'application » (Android/Chrome/Edge).

## Synchronisation (facultative)

Backend : Firebase Realtime Database (offre gratuite Spark), accédée par son API REST.

1. console.firebase.google.com > nouveau projet > Realtime Database > créer
   (région europe-west1).
2. Onglet Règles : coller `database.rules.json`, publier.
3. Dans l'application (ordinateur) : Réglages > coller l'adresse de la base > Générer un
   code > Activer. Un QR code s'affiche.
4. Téléphone : scanner le QR code avec l'appareil photo > l'application s'ouvre jumelée.

L'adresse peut être pré-remplie pour tous les appareils dans `js/config.js`.

Sécurité : chaque texte est chiffré dans le navigateur (AES-GCM 256, clé dérivée du
code de jumelage par PBKDF2-SHA256, 150 000 itérations). Le serveur ne stocke que des
données chiffrées, rangées sous un identifiant dérivé du code (SHA-256). Le code de
jumelage (100 bits) ne transite jamais vers le serveur ; le lien de jumelage le porte
dans le fragment `#` de l'URL, qui n'est pas transmis au serveur web.

## Avertissement réglementaire

Ni cette application ni Firebase ne sont certifiés « Hébergeur de données de santé »
(HDS, article L.1111-8 du Code de la santé publique). Ne saisissez aucune donnée
identifiante (nom, date de naissance, IPP...). Vérifiez la politique de sécurité de
votre établissement avant d'utiliser un appareil personnel ou un service cloud.

## Structure

```
index.html            interface
css/styles.css        styles (thème clair/sombre)
js/data.js            encarts, pastilles, examen normal, constantes
js/app.js             logique (dossiers, copie, réglages)
js/sync.js            synchronisation chiffrée
js/config.js          configuration (adresse Firebase par défaut)
js/vendor/qrcode.js   générateur de QR code (MIT)
sw.js                 hors ligne
database.rules.json   règles de sécurité Firebase
```
