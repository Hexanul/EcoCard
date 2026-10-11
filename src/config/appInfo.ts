import termsText from '../../legal/termeni.txt?raw';

declare const __APP_VERSION__: string;

// Injected from package.json by vite.config.ts.
export const APP_VERSION = __APP_VERSION__;

// legal/termeni.txt is also the installer's license page; it is saved with a
// UTF-8 BOM for NSIS, which the in-app display drops.
export const TERMS_TEXT = termsText.replace(/^\uFEFF/, '');

// Bump the "Versiunea termenilor" line in legal/termeni.txt whenever the
// terms change: every doctor is then asked to accept them again.
export const TERMS_REVISION = /Versiunea termenilor:\s*(\S+)/.exec(TERMS_TEXT)?.[1] ?? '';

export const TERMS_ACCEPTED_STORAGE_KEY = 'ecocard-terms-accepted';
