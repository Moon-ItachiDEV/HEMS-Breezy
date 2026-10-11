/* Interrupteur « Animations des flux » (WCAG 2.2.2) — partagé : coupe comètes, pulsations, nuages ; mémorisé dans ce navigateur
   seulement, sous la même clé sur toutes les pages. Mouvement réduit demandé par l'appareil : tout est déjà immobile,
   l'interrupteur n'a plus d'utilité et le pied est masqué. Contrat : la page déclare #btn-anim et #pied. */
const lireAnimations = () => { try { PAUSE = localStorage.getItem('breezy-animations') === '0'; } catch (_) { PAUSE = false; } };
function majInterrupteur() {
  $('btn-anim').setAttribute('aria-checked', String(!immobile()));
  $('pied').hidden = reduitMQ.matches;
  document.documentElement.classList.toggle('calme', immobile());
}
/* apres : ce que la page refait une fois l'interrupteur basculé (rendu immédiat, flux recréés) */
function basculerAnimations(apres) {
  if (reduitMQ.matches) return;
  PAUSE = !PAUSE;
  try { localStorage.setItem('breezy-animations', PAUSE ? '0' : '1'); } catch (_) { /* stockage indisponible */ }
  majInterrupteur();
  apres();
}
