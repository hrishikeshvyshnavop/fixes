// Clears the modal slot after navigating away from an intercepted route (e.g. after creating a project).
// Scoped to the signed-in sections only: a root-level catch-all would also claim /login, /signup and
// /invite, which Next 16 strict route matching rejects (those pages then 404).
export default function CatchAll() {
  return null;
}
