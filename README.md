# FASESIF — Site web du Gala de l'Excellence Ivoirienne

Site statique (HTML / CSS / JS, sans framework ni build) pour la FASESIF et son événement phare, le **G.E.E.I.F.** (03 octobre 2026, Paris).

## Structure du projet

```
fasesif/
├── index.html                 Accueil
├── a-propos.html               Notre Vision & Histoire, Prix d'Excellence, FAQ
├── candidature.html            Candidature — formulaire rapide (nom, email, CV, relevé)
├── candidature-dossier.html    Dossier complet en 3 étapes (Informations / Académique / Motivation)
├── contact.html                Coordonnées + formulaire de contact + carte
├── merci.html                  Confirmation après le formulaire rapide
├── mentions-legales.html
├── confidentialite.html
├── css/
│   ├── tokens.css              Couleurs, typographie, espacements, rayons (design system)
│   ├── base.css                Reset + classes typographiques + layout de base
│   ├── components.css          Header, footer, boutons, cartes, formulaires, stepper…
│   └── pages.css                Styles propres à chaque page (héros, grilles…)
├── js/
│   ├── main.js                 Menu mobile, accordéon FAQ, retours de formulaire
│   └── wizard.js                Logique du dossier de candidature en 3 étapes
└── assets/img/                 (dossier prévu pour vos futures photos)
```

## Design system

Toutes les couleurs et polices viennent d'un seul fichier : `css/tokens.css`
(variables CSS `--color-*`, `--font-*`, `--type-*`, `--radius-*`, `--spacing-*`).
Pour changer une couleur ou une police sur tout le site, il suffit de modifier
ce fichier.

- **Polices** : Playfair Display (titres) + Hanken Grotesk (texte), chargées
  depuis Google Fonts dans le `<head>` de chaque page.
- **Couleurs** : brun sienne `#954a00` (primaire), vert `#006d40` (secondaire),
  or `#c4a028` (accent), fond ivoire `#fcf9f2`.

## Photographies

Les héros (bandeaux d'image en haut des pages) utilisent pour l'instant des
dégradés CSS chaleureux à la place de vraies photos, car aucun visuel n'a été
fourni. Pour ajouter vos propres photos :

1. Déposez vos fichiers dans `assets/img/`.
2. Dans `css/pages.css`, remplacez la propriété `background-image` du bloc
   `.hero`, `.hero--home` ou `.hero--candidature` par :
   ```css
   background-image: url('assets/img/votre-photo.jpg');
   background-size: cover;
   background-position: center;
   ```

## Formulaires

Les formulaires (candidature rapide, dossier en 3 étapes, contact) sont
actuellement gérés **côté client uniquement** (JavaScript) : ils valident les
champs et affichent une confirmation, mais n'envoient rien à un serveur. Pour
recevoir réellement les candidatures par email, connectez-les à un service
comme [Formspree](https://formspree.io), [Getform](https://getform.io) ou une
fonction serverless (Netlify Forms, etc.) en changeant l'attribut `action` du
`<form>` et en adaptant `js/main.js` / `js/wizard.js`.

## Héberger sur GitHub Pages

1. Créez un dépôt GitHub (public) et poussez tout le contenu de ce dossier
   à la racine du dépôt.
2. Dans le dépôt : **Settings → Pages**.
3. Sous « Build and deployment », choisissez **Deploy from a branch**,
   branche `main`, dossier `/ (root)`.
4. Enregistrez : votre site sera disponible sous
   `https://<votre-utilisateur>.github.io/<nom-du-depot>/` en quelques
   minutes.

Aucune étape de build n'est nécessaire : ce sont des fichiers statiques.

## Accessibilité & responsive

- Navigation clavier (focus visible, lien d'évitement « Aller au contenu »).
- Menu mobile en dessous de 860px, grilles empilées en dessous de 900px/720px.
- `prefers-reduced-motion` respecté (désactive les transitions).
