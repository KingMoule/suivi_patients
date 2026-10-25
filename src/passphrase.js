export const MIN_LENGTH = 12;

// Retourne le message d'erreur à afficher, ou null si la phrase de passe est acceptable.
export function passphraseError(passphrase, confirmation) {
  if (passphrase.length < MIN_LENGTH) {
    return `La phrase de passe doit contenir au moins ${MIN_LENGTH} caractères.`;
  }
  if (passphrase !== confirmation) {
    return 'Les deux phrases de passe ne correspondent pas.';
  }
  return null;
}
