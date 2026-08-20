// Card Duel playtest slice entry (the /cards Vite entry, loaded by cards.html).
// Loads the active locale, then mounts the table. Only `en` is resident
// synchronously; a stored non-en locale lazy-loads here before the first
// localized paint (mirrors src/guide/main.ts and src/main.ts).

import './styles.css';
import { ensureLocaleLoaded, getLanguage } from '../ui/i18n';
import { CardsApp } from './app';

async function boot(): Promise<void> {
  const mount = document.getElementById('cards-app');
  if (!mount) return;
  try {
    await ensureLocaleLoaded(getLanguage());
  } catch {
    // A missing locale chunk falls back to English; render regardless.
  }
  new CardsApp(mount).start();
}

void boot();
