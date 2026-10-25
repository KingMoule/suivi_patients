# Travailler avec Claude sur ce projet

## Instructions de projet

À copier dans **Project settings > Memory > Project instructions**.
Les threads lisent `CLAUDE.md` tout seuls ; ce texte-ci dit comment ils travaillent.

```text
But : bâtir suivi_patients par petites étapes vérifiables, dans KingMoule/suivi_patients.

- Une tâche = une branche = une PR vers main. Jamais de push sur main.
- Avant la PR : les tests passent, sinon dire pourquoi.
- La description de PR sert de passation : fait, pas fait, comment vérifier.
- S'il manque une exigence, un accès ou un choix technique : le dire et s'arrêter. Ne pas inventer.
- Feu vert de Guillaume requis avant : d'ajouter une dépendance, de modifier le schéma
  de données, de toucher l'authentification ou les droits d'accès, de supprimer des
  fichiers ou de réécrire l'historique git.
- Choix du modèle par thread : Sonnet pour coder ; Opus pour l'architecture, la sécurité
  et les bugs difficiles ; Haiku pour résumer ou rédiger un texte simple.
- Une décision prise ou un piège confirmé va dans la mémoire de projet.
```

## Ce qui n'est pas automatique

Les threads cloud chargent `CLAUDE.md`, mais pas `.claude/settings.json` : un hook
placé dans le dépôt ne s'y exécute pas. Les vrais garde-fous sont donc dans GitHub :
protéger `main` (PR obligatoire) et activer *Secret scanning / Push protection*.
On ajoutera un hook seulement pour un besoin précis, en local.
