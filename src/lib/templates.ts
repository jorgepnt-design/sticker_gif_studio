/** Eingebaute, frei nutzbare Beispielvorlagen – vollständig bearbeitbar. */
import type { TemplateDef } from './types';

export const FONTS: { label: string; value: string }[] = [
  { label: 'Standard', value: 'system-ui, sans-serif' },
  { label: 'Impact', value: "Impact, 'Arial Black', sans-serif" },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Comic', value: "'Comic Sans MS', 'Chalkboard SE', cursive" },
  { label: 'Schreibmaschine', value: "'Courier New', monospace" },
  { label: 'Handschrift', value: "'Brush Script MT', 'Snell Roundhand', cursive" },
];

export const TEMPLATES: TemplateDef[] = [
  { id: 'gm', name: 'Guten Morgen', emoji: '🌅', text: 'Guten\nMorgen!', font: FONTS[5].value, color: '#f59e0b', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '☀️' },
  { id: 'gn', name: 'Gute Nacht', emoji: '🌙', text: 'Gute\nNacht', font: FONTS[5].value, color: '#a78bfa', strokeColor: '#1e1b4b', strokeWidth: 10, bg: null, extraEmoji: '😴' },
  { id: 'danke', name: 'Danke', emoji: '🙏', text: 'DANKE!', font: FONTS[1].value, color: '#10b981', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '💚' },
  { id: 'glueckwunsch', name: 'Glückwunsch', emoji: '🎉', text: 'Herzlichen\nGlückwunsch!', font: FONTS[0].value, color: '#ec4899', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🥳' },
  { id: 'liebe', name: 'Ich liebe dich', emoji: '❤️', text: 'Ich liebe\ndich', font: FONTS[5].value, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '💕' },
  { id: 'gleich-da', name: 'Bin gleich da', emoji: '🏃', text: 'Bin gleich\nda!', font: FONTS[3].value, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '💨' },
  { id: 'keine-zeit', name: 'Keine Zeit', emoji: '⏰', text: 'KEINE\nZEIT!', font: FONTS[1].value, color: '#f97316', strokeColor: '#7c2d12', strokeWidth: 10, bg: null, extraEmoji: '🙈' },
  { id: 'wochenende', name: 'Wochenende', emoji: '🎊', text: 'Endlich\nWochenende!', font: FONTS[3].value, color: '#8b5cf6', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🕺' },
  { id: 'urlaub', name: 'Urlaub', emoji: '🏖️', text: 'Ich bin im\nURLAUB', font: FONTS[0].value, color: '#0ea5e9', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🌴' },
  { id: 'fussball', name: 'Fußball', emoji: '⚽', text: 'TOOOOR!', font: FONTS[1].value, color: '#22c55e', strokeColor: '#14532d', strokeWidth: 12, bg: null, extraEmoji: '⚽' },
  { id: 'geburtstag', name: 'Geburtstag', emoji: '🎂', text: 'Alles Gute zum\nGeburtstag!', font: FONTS[5].value, color: '#f43f5e', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🎈' },
  { id: 'lol', name: 'Lustige Reaktion', emoji: '😂', text: 'LOL', font: FONTS[1].value, color: '#facc15', strokeColor: '#713f12', strokeWidth: 14, bg: null, extraEmoji: '🤣' },
  // --- Weitere Vorlagen ---
  { id: 'ok', name: 'Alles klar', emoji: '👍', text: 'Alles\nklar!', font: FONTS[1].value, color: '#22c55e', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '👌' },
  { id: 'wow', name: 'Wow', emoji: '🤩', text: 'WOW!', font: FONTS[1].value, color: '#f59e0b', strokeColor: '#7c2d12', strokeWidth: 12, bg: null, extraEmoji: '✨' },
  { id: 'nice', name: 'Nice', emoji: '😎', text: 'NICE', font: FONTS[1].value, color: '#0ea5e9', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🔥' },
  { id: 'haha', name: 'Hahaha', emoji: '🤣', text: 'HAHAHA', font: FONTS[1].value, color: '#facc15', strokeColor: '#713f12', strokeWidth: 12, bg: null, extraEmoji: '😹' },
  { id: 'wtf', name: 'Häää?', emoji: '🤨', text: 'Häää??', font: FONTS[3].value, color: '#f97316', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🤔' },
  { id: 'sorry', name: 'Sorry', emoji: '🙈', text: 'Sorry!', font: FONTS[5].value, color: '#ec4899', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🥺' },
  { id: 'bitte', name: 'Bitte', emoji: '🙏', text: 'Bitte\nbitte!', font: FONTS[5].value, color: '#8b5cf6', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🥹' },
  { id: 'nein', name: 'Nein', emoji: '🙅', text: 'NEIN!', font: FONTS[1].value, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 14, bg: null, extraEmoji: '🚫' },
  { id: 'ja', name: 'Ja klar', emoji: '🙆', text: 'JA\nklar!', font: FONTS[1].value, color: '#22c55e', strokeColor: '#14532d', strokeWidth: 12, bg: null, extraEmoji: '✅' },
  { id: 'hunger', name: 'Hunger', emoji: '🍕', text: 'Ich hab\nHunger!', font: FONTS[3].value, color: '#f97316', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '😋' },
  { id: 'kaffee', name: 'Kaffee', emoji: '☕', text: 'Erstmal\nKaffee', font: FONTS[5].value, color: '#92400e', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '☕' },
  { id: 'muede', name: 'Müde', emoji: '😴', text: 'So müde…', font: FONTS[5].value, color: '#6366f1', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🥱' },
  { id: 'proktor', name: 'Prost', emoji: '🍻', text: 'PROST!', font: FONTS[1].value, color: '#f59e0b', strokeColor: '#7c2d12', strokeWidth: 12, bg: null, extraEmoji: '🍻' },
  { id: 'glueck', name: 'Viel Glück', emoji: '🍀', text: 'Viel\nGlück!', font: FONTS[0].value, color: '#22c55e', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🍀' },
  { id: 'gute-besserung', name: 'Gute Besserung', emoji: '🤒', text: 'Gute\nBesserung', font: FONTS[5].value, color: '#0ea5e9', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '💐' },
  { id: 'vermisse', name: 'Vermisse dich', emoji: '🥰', text: 'Ich vermisse\ndich', font: FONTS[5].value, color: '#ec4899', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '💗' },
  { id: 'stolz', name: 'Stolz auf dich', emoji: '🥳', text: 'Stolz auf\ndich!', font: FONTS[0].value, color: '#8b5cf6', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🎉' },
  { id: 'weekend-mood', name: 'Wochenend-Stimmung', emoji: '🕺', text: 'Weekend\nMood', font: FONTS[1].value, color: '#ec4899', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '💃' },
  { id: 'stark', name: 'Stark', emoji: '💪', text: 'Du schaffst\ndas!', font: FONTS[1].value, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '💪' },
  { id: 'boom', name: 'Boom', emoji: '💥', text: 'BOOM!', font: FONTS[1].value, color: '#f97316', strokeColor: '#7c2d12', strokeWidth: 14, bg: null, extraEmoji: '🔥' },
  { id: 'top', name: 'Top', emoji: '💯', text: 'TOP!', font: FONTS[1].value, color: '#22c55e', strokeColor: '#ffffff', strokeWidth: 14, bg: null, extraEmoji: '💯' },
  { id: 'melde-dich', name: 'Melde dich', emoji: '📱', text: 'Melde\ndich!', font: FONTS[3].value, color: '#3b82f6', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '📲' },
  { id: 'komme-spaeter', name: 'Komme später', emoji: '🕒', text: 'Komme\nspäter', font: FONTS[0].value, color: '#f97316', strokeColor: '#ffffff', strokeWidth: 12, bg: null, extraEmoji: '🏃' },
  { id: 'frohe-ostern', name: 'Frohe Ostern', emoji: '🐰', text: 'Frohe\nOstern!', font: FONTS[5].value, color: '#a855f7', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🥚' },
  { id: 'frohe-weihnachten', name: 'Frohe Weihnachten', emoji: '🎄', text: 'Frohe\nWeihnachten', font: FONTS[5].value, color: '#ef4444', strokeColor: '#ffffff', strokeWidth: 10, bg: null, extraEmoji: '🎅' },
  { id: 'neujahr', name: 'Frohes neues Jahr', emoji: '🎆', text: 'Frohes neues\nJahr!', font: FONTS[0].value, color: '#f59e0b', strokeColor: '#7c2d12', strokeWidth: 10, bg: null, extraEmoji: '🥂' },
];

/** Emoji-Auswahl für den Editor */
export const EMOJI_SET = [
  '😀', '😂', '🤣', '😍', '😎', '🥳', '😭', '😡', '🤔', '😴',
  '👍', '👎', '👏', '🙏', '💪', '✌️', '🤙', '👀', '💯', '🔥',
  '❤️', '💕', '💚', '💙', '💜', '⭐', '✨', '🎉', '🎂', '🎈',
  '☀️', '🌙', '🌈', '⚽', '🏖️', '🌴', '🍕', '☕', '🐶', '🐱',
];
