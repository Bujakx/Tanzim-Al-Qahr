const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.db'));

// Czekaj do 30 sekund gdy baza jest zablokowana (zamiast rzucać błędem od razu)
db.exec('PRAGMA busy_timeout=30000;');

// Zamknij bazę poprawnie gdy proces kończy działanie
process.on('exit', () => { try { db.close(); } catch {} });
process.on('SIGINT', () => { try { db.close(); } catch {} process.exit(0); });
process.on('SIGTERM', () => { try { db.close(); } catch {} process.exit(0); });

// Inicjalizacja tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    user_id      TEXT PRIMARY KEY,
    username     TEXT NOT NULL,
    points       INTEGER DEFAULT 0,
    warnings     INTEGER DEFAULT 0,
    plusy        INTEGER DEFAULT 0,
    minusy       INTEGER DEFAULT 0,
    joined_at    TEXT DEFAULT (datetime('now')),
    last_updated TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS points_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    amount      INTEGER NOT NULL,
    reason      TEXT,
    given_by    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    reason      TEXT NOT NULL,
    given_by    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL,
    username      TEXT NOT NULL,
    wiek_ooc      TEXT,
    postac        TEXT,
    godziny       TEXT,
    serwery       TEXT,
    org_historia  TEXT,
    zasady        TEXT,
    dobre_rp      TEXT,
    przegrana     TEXT,
    dlaczego      TEXT,
    wklad         TEXT,
    status        TEXT DEFAULT 'pending',
    message_id    TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    resolved_at   TEXT,
    resolved_by   TEXT
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    username    TEXT NOT NULL,
    content     TEXT NOT NULL,
    message_id  TEXT,
    za          INTEGER DEFAULT 0,
    przeciw     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proposal_votes (
    proposal_id INTEGER NOT NULL,
    user_id     TEXT NOT NULL,
    vote        TEXT NOT NULL,
    PRIMARY KEY (proposal_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS promotions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    username    TEXT NOT NULL,
    type        TEXT NOT NULL,
    old_rank    TEXT,
    new_rank    TEXT,
    reason      TEXT,
    given_by    TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// Migracja — dodaj nowe kolumny do applications jeśli tabela istnieje ze starym schematem
const appCols = db.prepare("PRAGMA table_info(applications)").all().map(c => c.name);
const newAppCols = {
  wiek_ooc: 'TEXT', postac: 'TEXT', godziny: 'TEXT', serwery: 'TEXT',
  org_historia: 'TEXT', zasady: 'TEXT', dobre_rp: 'TEXT', przegrana: 'TEXT', wklad: 'TEXT',
};
for (const [col, type] of Object.entries(newAppCols)) {
  if (!appCols.includes(col)) {
    db.exec(`ALTER TABLE applications ADD COLUMN ${col} ${type}`);
  }
}

// --- Members ---

function ensureMember(userId, username) {
  if (!userId) return null;
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId);
  const existing = db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO members (user_id, username) VALUES (?, ?)').run([userId, safeUsername]);
  } else if (username && existing.username !== username) {
    db.prepare('UPDATE members SET username = ? WHERE user_id = ?').run([safeUsername, userId]);
  }
  return db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId);
}

function getMember(userId) {
  return db.prepare('SELECT * FROM members WHERE user_id = ?').get(userId);
}

// --- Punkty ---

function changePoints(userId, username, amount, reason, givenBy) {
  ensureMember(userId, username);
  db.prepare(`UPDATE members SET points = points + ?, last_updated = datetime('now') WHERE user_id = ?`).run([amount, userId]);
  db.prepare(`INSERT INTO points_history (user_id, amount, reason, given_by) VALUES (?, ?, ?, ?)`).run([userId, amount, reason, givenBy]);
  return db.prepare('SELECT points FROM members WHERE user_id = ?').get(userId);
}

function getPointsHistory(userId, limit = 10) {
  return db.prepare(`SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).all([userId, limit]);
}

function getLeaderboard(limit = 10) {
  return db.prepare(`SELECT * FROM members ORDER BY points DESC LIMIT ?`).all([limit]);
}

// --- Plusy / Minusy ---

function getPlusyMinusy(userId) {
  const row = db.prepare('SELECT plusy, minusy FROM members WHERE user_id = ?').get(userId);
  return row ?? { plusy: 0, minusy: 0 };
}

function setPlusy(userId, username, count) {
  ensureMember(userId, username);
  db.prepare(`UPDATE members SET plusy = ?, last_updated = datetime('now') WHERE user_id = ?`).run([count, userId]);
}

function setMinusy(userId, username, count) {
  ensureMember(userId, username);
  db.prepare(`UPDATE members SET minusy = ?, last_updated = datetime('now') WHERE user_id = ?`).run([count, userId]);
}

// --- Warny ---

function addWarning(userId, username, reason, givenBy) {
  ensureMember(userId, username);
  db.prepare(`UPDATE members SET warnings = warnings + 1, last_updated = datetime('now') WHERE user_id = ?`).run(userId);
  db.prepare(`INSERT INTO warnings (user_id, reason, given_by) VALUES (?, ?, ?)`).run([userId, reason, givenBy]);
  return db.prepare('SELECT warnings FROM members WHERE user_id = ?').get(userId);
}

function removeWarning(warningId, userId) {
  const warn = db.prepare('SELECT * FROM warnings WHERE id = ? AND user_id = ?').get([warningId, userId]);
  if (!warn) return null;
  db.prepare('DELETE FROM warnings WHERE id = ?').run(warningId);
  db.prepare(`UPDATE members SET warnings = MAX(0, warnings - 1) WHERE user_id = ?`).run(userId);
  return warn;
}

function getWarnings(userId) {
  return db.prepare(`SELECT * FROM warnings WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
}

// --- Aplikacje rekrutacyjne ---

function saveApplication(userId, username, answers) {
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId || 'unknown');
  db.prepare(
    'INSERT INTO applications (user_id, username, wiek_ooc, postac, godziny, serwery, org_historia, zasady, dobre_rp, przegrana, dlaczego, wklad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run([
    userId,
    safeUsername,
    answers.wiek_ooc     || null,
    answers.postac       || null,
    answers.godziny      || null,
    answers.serwery      || null,
    answers.org_historia || null,
    answers.zasady       || null,
    answers.dobre_rp     || null,
    answers.przegrana    || null,
    answers.dlaczego     || null,
    answers.wklad        || null,
  ]);
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

function getApplication(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
}

function updateApplicationStatus(id, status, resolvedBy) {
  db.prepare(`UPDATE applications SET status = ?, resolved_at = datetime('now'), resolved_by = ? WHERE id = ?`).run([status, resolvedBy, id]);
}

function setApplicationMessageId(id, messageId) {
  db.prepare('UPDATE applications SET message_id = ? WHERE id = ?').run([messageId, id]);
}

function getPendingApplicationByUser(userId) {
  return db.prepare(`SELECT * FROM applications WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`).get(userId);
}

// --- Propozycje ---

function saveProposal(userId, username, content) {
  db.prepare(`INSERT INTO proposals (user_id, username, content) VALUES (?, ?, ?)`).run([userId, username, content]);
  return db.prepare('SELECT last_insert_rowid() as id').get().id;
}

function updateProposalMessageId(proposalId, messageId) {
  db.prepare('UPDATE proposals SET message_id = ? WHERE id = ?').run([messageId, proposalId]);
}

function getProposalByMessageId(messageId) {
  return db.prepare('SELECT * FROM proposals WHERE message_id = ?').get(messageId);
}

function voteProposal(proposalId, userId, vote) {
  const existing = db.prepare('SELECT vote FROM proposal_votes WHERE proposal_id = ? AND user_id = ?').get([proposalId, userId]);

  if (existing) {
    if (existing.vote === vote) {
      // Cofnij głos
      db.prepare('DELETE FROM proposal_votes WHERE proposal_id = ? AND user_id = ?').run([proposalId, userId]);
      if (vote === 'za') db.prepare('UPDATE proposals SET za = MAX(0, za - 1) WHERE id = ?').run(proposalId);
      else db.prepare('UPDATE proposals SET przeciw = MAX(0, przeciw - 1) WHERE id = ?').run(proposalId);
      return 'removed';
    } else {
      // Zmień głos
      db.prepare('UPDATE proposal_votes SET vote = ? WHERE proposal_id = ? AND user_id = ?').run([vote, proposalId, userId]);
      if (vote === 'za') db.prepare('UPDATE proposals SET za = za + 1, przeciw = MAX(0, przeciw - 1) WHERE id = ?').run(proposalId);
      else db.prepare('UPDATE proposals SET przeciw = przeciw + 1, za = MAX(0, za - 1) WHERE id = ?').run(proposalId);
      return 'changed';
    }
  } else {
    db.prepare('INSERT INTO proposal_votes (proposal_id, user_id, vote) VALUES (?, ?, ?)').run([proposalId, userId, vote]);
    if (vote === 'za') db.prepare('UPDATE proposals SET za = za + 1 WHERE id = ?').run(proposalId);
    else db.prepare('UPDATE proposals SET przeciw = przeciw + 1 WHERE id = ?').run(proposalId);
    return 'added';
  }
}

// --- Awanse ---

function logPromotion(userId, username, type, oldRank, newRank, reason, givenBy) {
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId);
  db.prepare(`INSERT INTO promotions (user_id, username, type, old_rank, new_rank, reason, given_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    [userId, safeUsername, type, oldRank || '', newRank || '', reason || '', givenBy]
  );
}

module.exports = {
  db,
  ensureMember,
  getMember,
  changePoints,
  getPointsHistory,
  getLeaderboard,
  getPlusyMinusy,
  setPlusy,
  setMinusy,
  addWarning,
  removeWarning,
  getWarnings,
  saveApplication,
  getApplication,
  updateApplicationStatus,
  setApplicationMessageId,
  getPendingApplicationByUser,
  saveProposal,
  updateProposalMessageId,
  getProposalByMessageId,
  voteProposal,
  logPromotion,
  closeDb: () => { try { db.close(); } catch {} },
};

