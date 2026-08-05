// Jediné místo, kde se řeší cílová URL (test subdoména vs. lokální dev server) — importuje ho
// jak playwright.config.js (pro fixture `page`/`request`), tak testy, které si samy zakládají
// další browser context (např. messaging-and-notifications.spec.js — potřebuje trenéra i
// klienta otevřené najednou). Přepnuto z test.bloodandguts.cz na test.deusvultway.com 2026-08-05
// (brand rename/migrace domény, viz CLAUDE.md).
export const BASE_URL = process.env.E2E_BASE_URL || 'https://test.deusvultway.com'
