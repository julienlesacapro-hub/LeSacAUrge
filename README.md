# LeSacAUrge

![Logo](icons/icon-192.png)

Application web installable (PWA) pour téléphone et ordinateur : saisie au clavier
ou par la dictée vocale du clavier des paragraphes d'une observation d'urgence, puis
copie en **texte brut** d'un clic dans le logiciel d'observation.

©2026 LESACA Julien Tous droits réservés.

## Fonctions

- **Bandeau patient toujours visible** (localisation, identité, sexe, âge), coloré :
  rose femme, bleu homme, vert mineur (prioritaire), gris sexe non renseigné.
  Toucher le bandeau pour modifier ; bouton + pour un nouveau patient.
- **Barre de navigation** entre les encarts, toujours visible ; la pastille active suit
  le défilement, un point indique les encarts remplis.
- Encarts : Motif (masquable), Anamnèse, Antécédents médicaux, Antécédents chirurgicaux,
  Traitements habituels, Allergies, Examen clinique, Hypothèses diagnostiques, **ECG**,
  Conduite à tenir, Évolution, Conclusion.
- Un bouton **Copier** par encart + **Tout copier** (Ctrl+Maj+C) ; raccourcis Alt+1 à Alt+9.
- Copie en texte brut (guillemets, tirets, puces, émojis normalisés ; œ devient oe).
  Option « compatibilité stricte » qui retire aussi les accents.
- Pastilles préremplies, activables d'un toucher, personnalisables dans les réglages.
- Examen clinique : case « examen normal complet » ou sélection par appareil, constantes.
- **ECG** : bouton « ECG normal » (« RSR d'axe non dévié, à xx bpm, sans trouble de la
  conduction ni de la repolarisation, QTc à xx ms. »), saisie FC et QTc, anomalies à
  cocher (rythme, axe, conduction, repolarisation, autres) qui réécrivent la phrase.
  Si le texte a été modifié à la main, il n'est jamais écrasé sans confirmation.
- **Évolution horodatée** : chaque entrée a son heure et son bouton Copier ;
  « Copier les nouvelles » ne copie que les entrées pas encore copiées.
- **Check-list** par patient (réévaluation, biologie, imagerie, ECG, traitement, scope,
  avis cardio / chir / neuro / autre, lit, appel, documents de sortie, éléments libres) :
  à faire (orange) puis fait (vert). Vue « Patients en cours » (icône en haut, avec le
  nombre de tâches à faire) regroupant tous les patients et leurs icônes.
- Fonctionne hors ligne, thème clair/sombre, installable sur l'écran d'accueil.
- Synchronisation téléphone et ordinateur, **chiffrée de bout en bout**.
  L'identité (nom) n'est synchronisée que si l'option est activée dans les réglages.

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
(HDS, article L.1111-8 du Code de la santé publique). Le bandeau permet de saisir
l'identité du patient : elle reste par défaut sur l'appareil où elle est saisie et
n'est envoyée (chiffrée) que si l'option correspondante est activée. Vérifiez la politique de sécurité de
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
