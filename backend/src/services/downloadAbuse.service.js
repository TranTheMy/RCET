const { User } = require('../models');
const auditService = require('./audit.service');
const { USER_STATUS, AUDIT_ACTIONS, SYSTEM_ROLES } = require('../config/constants');

const WINDOW_MS = 30 * 1000;
const THRESHOLD = 3;
const IP_BLOCK_MS = 30 * 60 * 1000;

/** @type {Map<string, number[]>} */
const userDownloadHits = new Map();
/** @type {Map<string, number[]>} */
const ipDownloadHits = new Map();
/** @type {Map<string, number>} */
const ipBlockedUntil = new Map();

function nowMs() {
  return Date.now();
}

function pruneOldHits(timestamps, now) {
  return timestamps.filter((t) => now - t <= WINDOW_MS);
}

function shouldAutoBanRole(role) {
  return role === SYSTEM_ROLES.MEMBER || role === SYSTEM_ROLES.USER;
}

async function trackUserBurst(user, metadata) {
  if (!user?.id) return { banned: false, count: 0 };
  if (user.status === USER_STATUS.LOCKED) return { banned: true, count: THRESHOLD };

  const key = String(user.id);
  const now = nowMs();
  const hits = pruneOldHits(userDownloadHits.get(key) || [], now);
  hits.push(now);
  userDownloadHits.set(key, hits);

  if (hits.length < THRESHOLD || !shouldAutoBanRole(user.system_role)) {
    return { banned: false, count: hits.length };
  }

  const dbUser = await User.findByPk(user.id);
  if (!dbUser || dbUser.status === USER_STATUS.LOCKED) {
    return { banned: true, count: hits.length };
  }

  const previousStatus = dbUser.status;
  await dbUser.update({ status: USER_STATUS.LOCKED });

  await auditService.log(AUDIT_ACTIONS.USER_AUTO_BANNED, user.id, user.id, {
    reason: 'PUBLIC_RESEARCH_DOWNLOAD_BURST',
    threshold: THRESHOLD,
    window_ms: WINDOW_MS,
    count: hits.length,
    previous_status: previousStatus,
    ...metadata,
  });

  // reset bucket after enforcement
  userDownloadHits.delete(key);
  return { banned: true, count: hits.length };
}

async function trackIpBurst(ip, metadata) {
  if (!ip) return { blocked: false, count: 0, blocked_until: null };
  const now = nowMs();
  const currentBlockedUntil = ipBlockedUntil.get(ip);
  if (currentBlockedUntil && currentBlockedUntil > now) {
    return { blocked: true, count: THRESHOLD, blocked_until: currentBlockedUntil };
  }
  if (currentBlockedUntil && currentBlockedUntil <= now) {
    ipBlockedUntil.delete(ip);
  }

  const hits = pruneOldHits(ipDownloadHits.get(ip) || [], now);
  hits.push(now);
  ipDownloadHits.set(ip, hits);
  if (hits.length < THRESHOLD) {
    return { blocked: false, count: hits.length, blocked_until: null };
  }

  const blocked_until = now + IP_BLOCK_MS;
  ipBlockedUntil.set(ip, blocked_until);
  ipDownloadHits.delete(ip);
  await auditService.log(AUDIT_ACTIONS.RESEARCH_PUBLIC_IP_BLOCKED, null, null, {
    reason: 'PUBLIC_RESEARCH_DOWNLOAD_BURST_IP',
    threshold: THRESHOLD,
    window_ms: WINDOW_MS,
    block_ms: IP_BLOCK_MS,
    ip,
    ...metadata,
  });
  return { blocked: true, count: hits.length, blocked_until };
}

/**
 * user đăng nhập: auto-lock theo rule.
 * guest/IP: block tạm thời theo IP để giảm abuse.
 */
async function trackResearchPublicDownloadAndAutoBan({ user = null, ip = null, metadata = {} } = {}) {
  const userResult = await trackUserBurst(user, metadata);
  const ipResult = await trackIpBurst(ip, metadata);
  return {
    ...userResult,
    ...ipResult,
  };
}

module.exports = {
  trackResearchPublicDownloadAndAutoBan,
};
