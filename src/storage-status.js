// Traduit l'état du stockage du navigateur en un message pour l'utilisateur.
// Fonction pure : aucune API du navigateur ici, pour pouvoir la tester avec Node.
export function describeStorage({ supported, persisted, standalone }) {
  if (!supported) {
    return {
      ok: false,
      message: "Ce navigateur ne permet pas de protéger le stockage. N'y enregistrez aucune donnée.",
    };
  }
  if (!standalone) {
    return {
      ok: false,
      message: "Ajoutez l'app à l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »), puis ouvrez-la depuis l'icône.",
    };
  }
  if (!persisted) {
    return {
      ok: false,
      message: "Safari n'a pas accordé le stockage persistant. Les données pourraient être effacées.",
    };
  }
  return { ok: true, message: 'Stockage persistant accordé.' };
}
