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
];

/** Emoji-Auswahl für den Editor */
export const EMOJI_SET = [
  '😀', '😂', '🤣', '😍', '😎', '🥳', '😭', '😡', '🤔', '😴',
  '👍', '👎', '👏', '🙏', '💪', '✌️', '🤙', '👀', '💯', '🔥',
  '❤️', '💕', '💚', '💙', '💜', '⭐', '✨', '🎉', '🎂', '🎈',
  '☀️', '🌙', '🌈', '⚽', '🏖️', '🌴', '🍕', '☕', '🐶', '🐱',
];
