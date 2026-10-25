# suivi_patients

Outil de suivi de patients, projet du Cégep Gérald-Godin.
Stack : PWA pour iPad en JavaScript natif (modules ES), sans dépendance ni
build. Hébergée sur GitHub Pages (racine de `main`). Les données restent sur
l'iPad, jamais sur un serveur.

## Données (non négociable)
- Aucune donnée réelle de patient, nulle part : code, tests, captures,
  messages, tâches. Données fictives, manifestement fausses.
- Aucun secret versionné : `.env` est ignoré, `.env.example` sans valeurs.
- Ne jamais journaliser ni afficher un renseignement de santé ou un
  identifiant (logs, erreurs, messages de commit).

## Vérifier
- Tests : `npm test` (exécute `node --test`, Node 22+).
- Essai local : `python3 -m http.server` à la racine, puis http://localhost:8000.
- Lancer les tests avant de dire « terminé ». Montrer la sortie, pas une affirmation.

## Travailler
- Une tâche, une branche, une PR vers `main`. Une fonctionnalité à la fois.
- La solution la plus simple qui répond au besoin. Rien de non demandé.
- Code en anglais ; commentaires, docs et échanges en français.

<!-- Ajouter une règle seulement après la même erreur deux fois. Budget : 40 lignes ; au-delà, en retirer une. -->
