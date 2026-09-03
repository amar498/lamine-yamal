# Villa Immersive

Visite virtuelle 3D à la première personne d'une villa entièrement meublée : piscine à débordement, jacuzzi sur la terrasse, sauna et cave à vin en sous-sol, terrain de foot, et un grand jardin traversé à pied depuis le portail jusqu'à la porte d'entrée — comme dans un jeu vidéo.

Tout le monde (bâtiment, meubles, jardin, piscine, terrain) est généré procéduralement en Three.js : pas d'assets 3D externes à télécharger, tout tient dans ce dépôt.

## Lancer le site

Comme le site utilise des modules ES (`import`/`export`), il doit être servi par un petit serveur HTTP local (ouvrir `index.html` directement avec `file://` ne fonctionnera pas).

```bash
# Depuis la racine du projet, avec Python :
python3 -m http.server 8080

# ou avec Node (déjà disponible dans cet environnement) :
npx http-server -p 8080
```

Puis ouvrir `http://localhost:8080` dans un navigateur.

## Contrôles

- **Z Q S D** ou **flèches** : se déplacer
- **Souris** : regarder autour de soi
- **Maj** : courir
- **Espace** : sauter
- **Molette / F** : zoom (vue objectif)
- **M** : agrandir la mini-carte
- **Échap** : libérer la souris / pause

## Structure du code

- `index.html`, `style.css` — page et interface (écran de chargement, menu, HUD)
- `src/textures.js` — textures procédurales (bois, herbe, carrelage, marbre, ciel, terrain de foot…) et matériaux
- `src/objects.js` — briques réutilisables : murs, escaliers, meubles (canapé, lit, cuisine, salle de bain, sauna…)
- `src/house.js` — construction de la villa (rez-de-chaussée meublé + sous-sol avec sauna et cave à vin)
- `src/grounds.js` — jardin, allée, piscine + jacuzzi animés, terrain de foot, clôture, arbres
- `src/player.js` — déplacement à la première personne, collisions, gestion des étages (escalier vers la cave)
- `src/main.js` — assemblage de la scène, éclairage, ciel, boucle d'animation, interface
- `vendor/three/` — Three.js est inclus localement (pas de dépendance à un CDN au runtime)
