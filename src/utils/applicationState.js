// Mapa aktywnych podań rekrutacyjnych prowadzonych przez DM
// Map<userId, { step, answers, guildId, username, timeoutId }>
const activeApplications = new Map();

const QUESTIONS = [
  {
    key: 'wiek_ooc',
    label: 'Wiek OOC',
    text: '🎂 **Pytanie 1/10** — Jaki jest Twój **wiek OOC** (poza grą)?',
  },
  {
    key: 'postac',
    label: 'Imię i nazwisko postaci',
    text: '🪪 **Pytanie 2/10** — Jakie jest **imię i nazwisko Twojej postaci**?',
  },
  {
    key: 'godziny',
    label: 'Godziny w FiveM',
    text: '🕐 **Pytanie 3/10** — Ile masz **godzin w FiveM**?',
  },
  {
    key: 'serwery',
    label: 'Poprzednie serwery RP',
    text: '🌐 **Pytanie 4/10** — Na jakich **serwerach RP** grałeś/aś wcześniej?',
  },
  {
    key: 'org_historia',
    label: 'Historia w organizacjach',
    text: '🏴 **Pytanie 5/10** — Czy byłeś/aś już w jakiejś **organizacji przestępczej**? Jeśli tak — jakiej i jaką miałeś/aś rolę?',
  },
  {
    key: 'zasady',
    label: 'Zasady serwera',
    text: '📜 **Pytanie 6/10** — Czego **absolutnie nie wolno robić** na naszym serwerze?',
  },
  {
    key: 'dobre_rp',
    label: 'Dobre RP',
    text: '🎭 **Pytanie 7/10** — Co to dla Ciebie jest **dobre RP**?',
  },
  {
    key: 'przegrana',
    label: 'Reakcja na przegraną',
    text: '🤝 **Pytanie 8/10** — Co robisz, jeśli **akcja nie idzie po Twojej myśli** (np. przegrywasz sytuację)?',
  },
  {
    key: 'dlaczego',
    label: 'Motywacja',
    text: '💬 **Pytanie 9/10** — Dlaczego chcesz dołączyć właśnie do **naszej organizacji**?',
  },
  {
    key: 'wklad',
    label: 'Wkład w organizację',
    text: '⚔️ **Pytanie 10/10** — Co możesz **wnieść do naszej organizacji**?',
  },
];

// Timeout nieaktywności — 10 minut
const APPLICATION_TIMEOUT_MS = 10 * 60 * 1000;

module.exports = { activeApplications, QUESTIONS, APPLICATION_TIMEOUT_MS };
