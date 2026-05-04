const { Op } = require('sequelize');
const Document = require('../models/Document');
const Project = require('../models/Project');
const Curriculum = require('../models/Curriculum');
const Research = require('../models/Research');

const ALLOWED_SCOPES = ['all', 'project', 'document', 'curriculum', 'research'];
const LIMIT = 8;

const emptyBuckets = () => ({
  documents: [],
  projects: [],
  curriculums: [],
  research: [],
});

const TAG_STRIP_RE = /@(?:curriculum|document|doc|project|research)\b/gi;

/**
 * Nhận diện tag @ trong chuỗi (word boundary, tránh @research khớp @research_xyz).
 */
function parseScopeFromQuery(raw) {
  let scope = 'all';
  if (/@curriculum\b/i.test(raw)) scope = 'curriculum';
  else if (/@(?:document|doc)\b/i.test(raw)) scope = 'document';
  else if (/@project\b/i.test(raw)) scope = 'project';
  else if (/@research\b/i.test(raw)) scope = 'research';

  const keyword = raw.replace(TAG_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
  return { scope, keyword, tagSource: scope !== 'all' };
}

function normalizeScopeParam(scopeParam) {
  if (!scopeParam || typeof scopeParam !== 'string') return null;
  const s = scopeParam.toLowerCase().trim();
  return ALLOWED_SCOPES.includes(s) ? s : null;
}

/**
 * @param {{ q?: string, scope?: string }} input
 * - Cơ chế global: không có scope (hoặc all) và không dùng tag @ → tìm trên mọi loại (cần từ khóa).
 * - Cơ chế scoped: query ?scope=project | … hoặc chuỗi q có @tag → chỉ tìm trong phân vùng đó.
 */
async function searchAllData(input) {
  const rawQ = typeof input === 'string' ? input : input?.q;
  const scopeFromClient = typeof input === 'object' && input !== null ? input.scope : undefined;

  const raw = String(rawQ || '').trim();
  const paramScope = normalizeScopeParam(scopeFromClient);

  let scope = 'all';
  let keyword = raw;
  let scopeSource = 'none';

  if (paramScope && paramScope !== 'all') {
    scope = paramScope;
    keyword = raw.replace(TAG_STRIP_RE, ' ').replace(/\s+/g, ' ').trim();
    scopeSource = 'query';
  } else {
    const parsed = parseScopeFromQuery(raw);
    if (parsed.scope !== 'all') {
      scope = parsed.scope;
      keyword = parsed.keyword;
      scopeSource = 'tag';
    }
  }

  const mode = scope === 'all' ? 'global' : 'scoped';
  const meta = {
    mode,
    scope,
    keyword,
    scopeSource,
  };

  const results = { ...emptyBuckets(), meta };

  if (mode === 'global' && !keyword) {
    return results;
  }

  const likeWhere = (field) => ({ [field]: { [Op.like]: `%${keyword}%` } });
  const recentOrder = [['updated_at', 'DESC']];
  const baseLimit = { limit: LIMIT };

  const runDocument = async () => {
    if (keyword) {
      const rows = await Document.findAll({ where: likeWhere('title'), ...baseLimit });
      results.documents = rows.map((d) => ({ Id: d.id, Title: d.title, Type: 'document' }));
    } else {
      const rows = await Document.findAll({ order: recentOrder, ...baseLimit });
      results.documents = rows.map((d) => ({ Id: d.id, Title: d.title, Type: 'document' }));
    }
  };

  const runProject = async () => {
    if (keyword) {
      const rows = await Project.findAll({ where: likeWhere('name'), ...baseLimit });
      results.projects = rows.map((p) => ({ Id: p.id, Title: p.name, Type: 'project' }));
    } else {
      const rows = await Project.findAll({ order: recentOrder, ...baseLimit });
      results.projects = rows.map((p) => ({ Id: p.id, Title: p.name, Type: 'project' }));
    }
  };

  const runCurriculum = async () => {
    if (keyword) {
      const rows = await Curriculum.findAll({ where: likeWhere('title'), ...baseLimit });
      results.curriculums = rows.map((c) => ({ Id: c.id, Title: c.title, Type: 'curriculum' }));
    } else {
      const rows = await Curriculum.findAll({ order: recentOrder, ...baseLimit });
      results.curriculums = rows.map((c) => ({ Id: c.id, Title: c.title, Type: 'curriculum' }));
    }
  };

  const runResearch = async () => {
    if (keyword) {
      const rows = await Research.findAll({ where: likeWhere('title'), ...baseLimit });
      results.research = rows.map((r) => ({ Id: r.id, Title: r.title, Type: 'research' }));
    } else {
      const rows = await Research.findAll({ order: recentOrder, ...baseLimit });
      results.research = rows.map((r) => ({ Id: r.id, Title: r.title, Type: 'research' }));
    }
  };

  const promises = [];
  if (scope === 'all') {
    promises.push(runDocument(), runProject(), runCurriculum(), runResearch());
  } else if (scope === 'document') {
    promises.push(runDocument());
  } else if (scope === 'project') {
    promises.push(runProject());
  } else if (scope === 'curriculum') {
    promises.push(runCurriculum());
  } else if (scope === 'research') {
    promises.push(runResearch());
  }

  await Promise.all(promises);
  return results;
}

module.exports = { searchAllData };
