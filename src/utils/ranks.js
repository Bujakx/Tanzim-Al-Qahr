// Hierarchia rang od najniższej (0) do najwyższej (8)
const HIERARCHY = [
  { name: 'Mustajad',  id: '1497209983610392666', description: 'kandydat',             role: 'Kandydat — brak dostępu do szafki',                                      emoji: '🔎' },
  { name: 'Jadid',     id: '1496623783853686855', description: 'nowicjusz',            role: 'Nowicjusz — brak dostępu do szafki',                                     emoji: '🌑' },
  { name: 'Talib',     id: '1496623621056106689', description: 'członek',              role: 'Członek — dostęp do szafki',                                             emoji: '📜' },
  { name: 'Jundi',     id: '1496623537400709281', description: 'zaufany członek',      role: 'Zaufany członek — dostęp do szafki',                                     emoji: '⚔️' },
  { name: 'Hafiz',     id: '1496623471592083606', description: 'koordynator',          role: 'Koordynator',                                                            emoji: '🛡️' },
  { name: 'Amir',      id: '1496623392563003494', description: 'dowódca',              role: 'Dowódca',                                                                emoji: '🗡️' },
  { name: 'Nazir',     id: '1496623289190187160', description: 'doradca',              role: 'Doradca — może dodawać członków',                                        emoji: '⭐' },
  { name: 'Rais',      id: '1496623113532608512', description: 'zastępca przywódcy',   role: 'Zastępca przywódcy',                                                     emoji: '💎' },
  { name: "Al-Qa'id",  id: '1496622820975968357', description: 'przywódca',            role: 'Przywódca organizacji',                                                  emoji: '👑' },
];
// Indeksy rang w HIERARCHY:
// 0=Mustajad  1=Jadid  2=Talib  3=Jundi  4=Hafiz  5=Amir  6=Nazir  7=Rais  8=Al-Qa'id

// Role uprawnione do awansów / degradacji (szef + zastępca)
const MANAGEMENT_ROLES = [
  '1496622820975968357', // Al-Qa'id
  '1496623113532608512', // Rais
];

// Role uprawnione do plusów / minusów (szef + zastępca + Nazir)
const STAFF_ROLES = [
  '1496622820975968357', // Al-Qa'id
  '1496623113532608512', // Rais
  '1496623289190187160', // Nazir
];

// Role plusów (indeks 0 = 1 plus, indeks 2 = 3 plusy)
const PLUS_ROLES = [
  '1496640575737303322',
  '1496640597359071232',
  '1496640615113560134',
];

// Role minusów
const MINUS_ROLES = [
  '1496640635019595877',
  '1496640664509612042',
  '1496640679147868433',
];

/**
 * Pobiera rangę członka na podstawie jego ról
 */
function getMemberRank(guildMember) {
  for (let i = HIERARCHY.length - 1; i >= 0; i--) {
    if (guildMember.roles.cache.has(HIERARCHY[i].id)) {
      return { rank: HIERARCHY[i], index: i };
    }
  }
  return null;
}

/**
 * Pobiera rangę po nazwie
 */
function getRankByName(name) {
  const lower = name.toLowerCase();
  return HIERARCHY.find(r => r.name.toLowerCase() === lower ||
    r.name.toLowerCase().replace("'", '') === lower.replace("'", ''));
}

/**
 * Pobiera rangę po ID roli
 */
function getRankById(roleId) {
  return HIERARCHY.find(r => r.id === roleId);
}

/**
 * Sprawdza czy member może nadawać awanse/degradacje (szef + zastępca + OWNER_IDS)
 */
function isManagement(guildMember) {
  const ownerIds = (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ownerIds.includes(guildMember.id)) return true;
  if (guildMember.guild.ownerId === guildMember.id) return true;
  return (
    guildMember.permissions.has('Administrator') ||
    MANAGEMENT_ROLES.some(id => guildMember.roles.cache.has(id))
  );
}

/**
 * Sprawdza czy member może nadawać plusy/minusy (szef + zastępca + Nazir + OWNER_IDS)
 */
function isStaff(guildMember) {
  const ownerIds = (process.env.OWNER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ownerIds.includes(guildMember.id)) return true;
  if (guildMember.guild.ownerId === guildMember.id) return true;
  return (
    guildMember.permissions.has('Administrator') ||
    STAFF_ROLES.some(id => guildMember.roles.cache.has(id))
  );
}

/**
 * Usuwa wszystkie rangi organizacji z membera i nadaje nową
 */
async function setRank(guildMember, newRankId) {
  const rankIds = HIERARCHY.map(r => r.id);
  const toRemove = rankIds.filter(id => id !== newRankId && guildMember.roles.cache.has(id));
  for (const id of toRemove) {
    await guildMember.roles.remove(id).catch(err => console.error('[setRank] Nie udalo sie usunac roli', id, err.message));
  }
  await guildMember.roles.add(newRankId).catch(err => console.error('[setRank] Nie udalo sie nadac roli', newRankId, err.message));
}

/**
 * Liczy aktualne plusy membera (0-3) — ile ról plusów ma nadanych
 */
function getPlusCount(guildMember) {
  return PLUS_ROLES.filter(id => guildMember.roles.cache.has(id)).length;
}

/**
 * Liczy aktualne minusy membera (0-3) — ile ról minusów ma nadanych
 */
function getMinusCount(guildMember) {
  return MINUS_ROLES.filter(id => guildMember.roles.cache.has(id)).length;
}

/**
 * Ustawia liczbę plusów — kumulatywnie:
 *   count=1 → role[0]
 *   count=2 → role[0] + role[1]
 *   count=3 → role[0] + role[1] + role[2]
 *   count=0 → usuwa wszystkie
 */
async function setPlusRoles(guildMember, count) {
  for (let i = 0; i < PLUS_ROLES.length; i++) {
    if (i < count) {
      await guildMember.roles.add(PLUS_ROLES[i]).catch(() => {});
    } else {
      await guildMember.roles.remove(PLUS_ROLES[i]).catch(() => {});
    }
  }
}

/**
 * Ustawia liczbę minusów — kumulatywnie:
 *   count=1 → role[0]
 *   count=2 → role[0] + role[1]
 *   count=3 → role[0] + role[1] + role[2]
 *   count=0 → usuwa wszystkie
 */
async function setMinusRoles(guildMember, count) {
  for (let i = 0; i < MINUS_ROLES.length; i++) {
    if (i < count) {
      await guildMember.roles.add(MINUS_ROLES[i]).catch(() => {});
    } else {
      await guildMember.roles.remove(MINUS_ROLES[i]).catch(() => {});
    }
  }
}

module.exports = {
  HIERARCHY,
  MANAGEMENT_ROLES,
  STAFF_ROLES,
  PLUS_ROLES,
  MINUS_ROLES,
  getMemberRank,
  getRankByName,
  getRankById,
  isManagement,
  isStaff,
  setRank,
  getPlusCount,
  getMinusCount,
  setPlusRoles,
  setMinusRoles,
};
