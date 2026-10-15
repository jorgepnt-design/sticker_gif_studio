let counter = 0;

/** Eindeutige ID für Listeneinträge (crypto.randomUUID fehlt außerhalb von HTTPS) */
export function uid(): string {
  return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
