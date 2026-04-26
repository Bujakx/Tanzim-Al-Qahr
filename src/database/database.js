const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'tanzim',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS members (
      user_id      VARCHAR(30)  PRIMARY KEY,
      username     VARCHAR(100) NOT NULL,
      points       INT          DEFAULT 0,
      warnings     INT          DEFAULT 0,
      plusy        INT          DEFAULT 0,
      minusy       INT          DEFAULT 0,
      joined_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS points_history (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    VARCHAR(30)  NOT NULL,
      amount     INT          NOT NULL,
      reason     TEXT,
      given_by   VARCHAR(30)  NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS warnings (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    VARCHAR(30)  NOT NULL,
      reason     TEXT         NOT NULL,
      given_by   VARCHAR(30)  NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS applications (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       VARCHAR(30)  NOT NULL,
      username      VARCHAR(100) NOT NULL,
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
      status        VARCHAR(20)  DEFAULT 'pending',
      message_id    VARCHAR(30),
      created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
      resolved_at   DATETIME,
      resolved_by   VARCHAR(30)
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS proposals (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    VARCHAR(30)  NOT NULL,
      username   VARCHAR(100) NOT NULL,
      content    TEXT         NOT NULL,
      message_id VARCHAR(30),
      za         INT          DEFAULT 0,
      przeciw    INT          DEFAULT 0,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS proposal_votes (
      proposal_id INT         NOT NULL,
      user_id     VARCHAR(30) NOT NULL,
      vote        VARCHAR(10) NOT NULL,
      PRIMARY KEY (proposal_id, user_id)
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS promotions (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    VARCHAR(30)  NOT NULL,
      username   VARCHAR(100) NOT NULL,
      type       VARCHAR(20)  NOT NULL,
      old_rank   VARCHAR(50),
      new_rank   VARCHAR(50),
      reason     TEXT,
      given_by   VARCHAR(30)  NOT NULL,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);    await conn.query(`CREATE TABLE IF NOT EXISTS storage (
      item_name  VARCHAR(100) PRIMARY KEY,
      quantity   INT          NOT NULL DEFAULT 0
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS storage_log (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      item_name        VARCHAR(100) NOT NULL,
      action           VARCHAR(10)  NOT NULL,
      quantity         INT          NOT NULL,
      user_ic          VARCHAR(100) NOT NULL,
      user_id          VARCHAR(30)  NOT NULL,
      source_or_reason TEXT,
      created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS settings (
      key_name   VARCHAR(50)  PRIMARY KEY,
      value      TEXT
    ) CHARSET=utf8mb4`);
    await conn.query(`CREATE TABLE IF NOT EXISTS finance (
      id      INT AUTO_INCREMENT PRIMARY KEY,
      balance BIGINT NOT NULL DEFAULT 0
    ) CHARSET=utf8mb4`);
    await conn.query(`INSERT IGNORE INTO finance (id, balance) VALUES (1, 0)`);
    await conn.query(`CREATE TABLE IF NOT EXISTS finance_log (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      action           VARCHAR(10)  NOT NULL,
      amount           BIGINT       NOT NULL,
      user_ic          VARCHAR(100) NOT NULL,
      user_id          VARCHAR(30)  NOT NULL,
      reason           TEXT,
      balance_after    BIGINT       NOT NULL,
      created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);    await conn.query(`CREATE TABLE IF NOT EXISTS numery (
      user_id       VARCHAR(30)  PRIMARY KEY,
      numer         VARCHAR(20)  NOT NULL,
      imie_nazwisko VARCHAR(60)  NOT NULL DEFAULT '',
      updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARSET=utf8mb4`);
    // Migracja: dodaj kolumne imie_nazwisko jesli jeszcze nie istnieje
    await conn.query(`ALTER TABLE numery ADD COLUMN imie_nazwisko VARCHAR(60) NOT NULL DEFAULT ''`).catch(err => {
      if (err.errno !== 1060) throw err; // 1060 = duplicate column - ignoruj
    });
    console.log('✅ Baza danych (MySQL) gotowa!');
  } finally {
    conn.release();
  }
}

// --- Members ---

async function ensureMember(userId, username) {
  if (!userId) return null;
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId);
  await pool.query(
    `INSERT INTO members (user_id, username) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE username = IF(? <> '', VALUES(username), username)`,
    [userId, safeUsername, safeUsername]
  );
}

async function getMember(userId) {
  const [rows] = await pool.query('SELECT * FROM members WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

// --- Punkty ---

async function changePoints(userId, username, amount, reason, givenBy) {
  await ensureMember(userId, username);
  await pool.query('UPDATE members SET points = points + ? WHERE user_id = ?', [amount, userId]);
  await pool.query('INSERT INTO points_history (user_id, amount, reason, given_by) VALUES (?, ?, ?, ?)', [userId, amount, reason, givenBy]);
  const [rows] = await pool.query('SELECT points FROM members WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function getPointsHistory(userId, limit = 10) {
  const [rows] = await pool.query('SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
  return rows;
}

async function getLeaderboard(limit = 10) {
  const [rows] = await pool.query('SELECT * FROM members ORDER BY points DESC LIMIT ?', [limit]);
  return rows;
}

// --- Plusy / Minusy ---

async function getPlusyMinusy(userId) {
  const [rows] = await pool.query('SELECT plusy, minusy FROM members WHERE user_id = ?', [userId]);
  return rows[0] || { plusy: 0, minusy: 0 };
}

async function setPlusy(userId, username, count) {
  await ensureMember(userId, username);
  await pool.query('UPDATE members SET plusy = ? WHERE user_id = ?', [count, userId]);
}

async function setMinusy(userId, username, count) {
  await ensureMember(userId, username);
  await pool.query('UPDATE members SET minusy = ? WHERE user_id = ?', [count, userId]);
}

// --- Warny ---

async function addWarning(userId, username, reason, givenBy) {
  await ensureMember(userId, username);
  await pool.query('UPDATE members SET warnings = warnings + 1 WHERE user_id = ?', [userId]);
  await pool.query('INSERT INTO warnings (user_id, reason, given_by) VALUES (?, ?, ?)', [userId, reason, givenBy]);
  const [rows] = await pool.query('SELECT warnings FROM members WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function removeWarning(warningId, userId) {
  const [rows] = await pool.query('SELECT * FROM warnings WHERE id = ? AND user_id = ?', [warningId, userId]);
  const warn = rows[0];
  if (!warn) return null;
  await pool.query('DELETE FROM warnings WHERE id = ?', [warningId]);
  await pool.query('UPDATE members SET warnings = GREATEST(0, warnings - 1) WHERE user_id = ?', [userId]);
  return warn;
}

async function getWarnings(userId) {
  const [rows] = await pool.query('SELECT * FROM warnings WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows;
}

// --- Aplikacje rekrutacyjne ---

async function saveApplication(userId, username, answers) {
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId || 'unknown');
  const [result] = await pool.query(
    'INSERT INTO applications (user_id, username, wiek_ooc, postac, godziny, serwery, org_historia, zasady, dobre_rp, przegrana, dlaczego, wklad) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
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
    ]
  );
  return result.insertId;
}

async function getApplication(id) {
  const [rows] = await pool.query('SELECT * FROM applications WHERE id = ?', [id]);
  return rows[0] || null;
}

async function updateApplicationStatus(id, status, resolvedBy) {
  await pool.query('UPDATE applications SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?', [status, resolvedBy, id]);
}

async function setApplicationMessageId(id, messageId) {
  await pool.query('UPDATE applications SET message_id = ? WHERE id = ?', [messageId, id]);
}

async function getPendingApplicationByUser(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM applications WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  return rows[0] || null;
}

// --- Propozycje ---

async function saveProposal(userId, username, content) {
  const [result] = await pool.query(
    'INSERT INTO proposals (user_id, username, content) VALUES (?, ?, ?)',
    [userId, username, content]
  );
  return result.insertId;
}

async function updateProposalMessageId(proposalId, messageId) {
  await pool.query('UPDATE proposals SET message_id = ? WHERE id = ?', [messageId, proposalId]);
}

async function getProposalByMessageId(messageId) {
  const [rows] = await pool.query('SELECT * FROM proposals WHERE message_id = ?', [messageId]);
  return rows[0] || null;
}

async function voteProposal(proposalId, userId, vote) {
  const [existing] = await pool.query(
    'SELECT vote FROM proposal_votes WHERE proposal_id = ? AND user_id = ?',
    [proposalId, userId]
  );

  if (existing.length > 0) {
    if (existing[0].vote === vote) {
      await pool.query('DELETE FROM proposal_votes WHERE proposal_id = ? AND user_id = ?', [proposalId, userId]);
      if (vote === 'za') await pool.query('UPDATE proposals SET za = GREATEST(0, za - 1) WHERE id = ?', [proposalId]);
      else await pool.query('UPDATE proposals SET przeciw = GREATEST(0, przeciw - 1) WHERE id = ?', [proposalId]);
      return 'removed';
    } else {
      await pool.query('UPDATE proposal_votes SET vote = ? WHERE proposal_id = ? AND user_id = ?', [vote, proposalId, userId]);
      if (vote === 'za') await pool.query('UPDATE proposals SET za = za + 1, przeciw = GREATEST(0, przeciw - 1) WHERE id = ?', [proposalId]);
      else await pool.query('UPDATE proposals SET przeciw = przeciw + 1, za = GREATEST(0, za - 1) WHERE id = ?', [proposalId]);
      return 'changed';
    }
  } else {
    await pool.query('INSERT INTO proposal_votes (proposal_id, user_id, vote) VALUES (?, ?, ?)', [proposalId, userId, vote]);
    if (vote === 'za') await pool.query('UPDATE proposals SET za = za + 1 WHERE id = ?', [proposalId]);
    else await pool.query('UPDATE proposals SET przeciw = przeciw + 1 WHERE id = ?', [proposalId]);
    return 'added';
  }
}

// --- Awanse ---

async function logPromotion(userId, username, type, oldRank, newRank, reason, givenBy) {
  const safeUsername = (username && typeof username === 'string' && username.length > 0) ? username : String(userId);
  await pool.query(
    'INSERT INTO promotions (user_id, username, type, old_rank, new_rank, reason, given_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, safeUsername, type, oldRank || '', newRank || '', reason || '', givenBy]
  );
}

// --- Szafka ---

async function addStorageItem(itemName, quantity, userIc, userId, source) {
  await pool.query(
    'INSERT INTO storage (item_name, quantity) VALUES (?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
    [itemName, quantity, quantity]
  );
  await pool.query(
    'INSERT INTO storage_log (item_name, action, quantity, user_ic, user_id, source_or_reason) VALUES (?, ?, ?, ?, ?, ?)',
    [itemName, 'wloz', quantity, userIc, userId, source || null]
  );
  const [rows] = await pool.query('SELECT quantity FROM storage WHERE item_name = ?', [itemName]);
  return rows[0]?.quantity ?? quantity;
}

async function removeStorageItem(itemName, quantity, userIc, userId, reason) {
  const [rows] = await pool.query('SELECT quantity FROM storage WHERE item_name = ?', [itemName]);
  if (!rows.length || rows[0].quantity < quantity) {
    return { success: false, available: rows[0]?.quantity ?? 0 };
  }
  await pool.query('UPDATE storage SET quantity = quantity - ? WHERE item_name = ?', [quantity, itemName]);
  await pool.query(
    'INSERT INTO storage_log (item_name, action, quantity, user_ic, user_id, source_or_reason) VALUES (?, ?, ?, ?, ?, ?)',
    [itemName, 'wyjmij', quantity, userIc, userId, reason || null]
  );
  const [updated] = await pool.query('SELECT quantity FROM storage WHERE item_name = ?', [itemName]);
  return { success: true, newQuantity: updated[0]?.quantity ?? 0 };
}

async function getStorage() {
  const [rows] = await pool.query('SELECT * FROM storage WHERE quantity > 0 ORDER BY item_name ASC');
  return rows;
}

async function getStorageLog(limit = 10) {
  const [rows] = await pool.query('SELECT * FROM storage_log ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows;
}

async function getSetting(key) {
  const [rows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', [key]);
  return rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
    [key, value, value]
  );
}

// --- Finanse ---

async function getBalance() {
  const [rows] = await pool.query('SELECT balance FROM finance WHERE id = 1');
  return rows[0]?.balance ?? 0;
}

async function depositMoney(amount, userIc, userId, reason) {
  await pool.query('UPDATE finance SET balance = balance + ? WHERE id = 1', [amount]);
  const [rows] = await pool.query('SELECT balance FROM finance WHERE id = 1');
  const balanceAfter = rows[0].balance;
  await pool.query(
    'INSERT INTO finance_log (action, amount, user_ic, user_id, reason, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
    ['wplata', amount, userIc, userId, reason || null, balanceAfter]
  );
  return balanceAfter;
}

async function withdrawMoney(amount, userIc, userId, reason) {
  const [rows] = await pool.query('SELECT balance FROM finance WHERE id = 1');
  const current = rows[0]?.balance ?? 0;
  if (current < amount) return { success: false, available: current };
  await pool.query('UPDATE finance SET balance = balance - ? WHERE id = 1', [amount]);
  const [updated] = await pool.query('SELECT balance FROM finance WHERE id = 1');
  const balanceAfter = updated[0].balance;
  await pool.query(
    'INSERT INTO finance_log (action, amount, user_ic, user_id, reason, balance_after) VALUES (?, ?, ?, ?, ?, ?)',
    ['wyplata', amount, userIc, userId, reason || null, balanceAfter]
  );
  return { success: true, balanceAfter };
}

async function getFinanceLog(limit = 10) {
  const [rows] = await pool.query('SELECT * FROM finance_log ORDER BY created_at DESC LIMIT ?', [limit]);
  return rows;
}

// --- Numery ---

async function setNumer(userId, numer, imieNazwisko) {
  await pool.query(
    'INSERT INTO numery (user_id, numer, imie_nazwisko) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE numer = ?, imie_nazwisko = ?',
    [userId, numer, imieNazwisko, numer, imieNazwisko]
  );
}

async function removeNumer(userId) {
  await pool.query('DELETE FROM numery WHERE user_id = ?', [userId]);
}

async function removeNumerByName(imieNazwisko) {
  // Zwraca liczbe usuniętych wierszy
  const [result] = await pool.query('DELETE FROM numery WHERE LOWER(imie_nazwisko) = LOWER(?)', [imieNazwisko]);
  return result.affectedRows;
}

async function getNumer(userId) {
  const [rows] = await pool.query('SELECT numer, imie_nazwisko FROM numery WHERE user_id = ?', [userId]);
  return rows[0] ?? null; // { numer, imie_nazwisko } or null
}

async function getAllNumery() {
  const [rows] = await pool.query('SELECT user_id, numer, imie_nazwisko FROM numery ORDER BY CAST(numer AS UNSIGNED) ASC, numer ASC');
  return rows;
}

module.exports = {
  pool,
  initDb,
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
  addStorageItem,
  removeStorageItem,
  getStorage,
  getStorageLog,
  getSetting,
  setSetting,
  getBalance,
  depositMoney,
  withdrawMoney,
  getFinanceLog,
  setNumer,
  removeNumer,
  removeNumerByName,
  getNumer,
  getAllNumery,
};

