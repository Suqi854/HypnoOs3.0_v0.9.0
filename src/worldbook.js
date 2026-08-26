import { SCHEMA_IDS } from './constants.js';
import { getRegionPack } from './regions.js';
import { clone, isRecord, makeId, sanitizeName, sha256, stableStringify } from './utils.js';

function entriesOf(book) {
  if (Array.isArray(book?.entries)) return book.entries;
  if (isRecord(book?.entries)) return Object.values(book.entries);
  return [];
}

function inertText(value, limit = 20_000) {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, '[已隔离脚本]').replace(/<iframe[\s\S]*?<\/iframe>/gi, '[已隔离iframe]').slice(0, limit);
}

export async function scanWorldbooks(host, names) {
  const books = [];
  for (const name of names) {
    const book = await host.loadWorldbook(name);
    if (!book) continue;
    const entries = entriesOf(book).map((entry) => ({
      uid: entry.uid ?? entry.id ?? null,
      title: String(entry.comment || entry.name || ''),
      keys: Array.isArray(entry.key) ? entry.key.map(String) : Array.isArray(entry.keys) ? entry.keys.map(String) : [],
      content: inertText(entry.content),
      enabled: entry.disable !== true && entry.enabled !== false,
    }));
    books.push({ name, hash: await sha256(stableStringify(book)), entries });
  }
  return books;
}

export function deterministicAdapterDraft(books, state) {
  const roles = [];
  const locations = [];
  const rules = [];
  const variableHints = [];
  for (const book of books) {
    for (const entry of book.entries) {
      const label = `${entry.title} ${entry.keys.join(' ')}`;
      const item = { sourceBook: book.name, sourceUid: entry.uid, title: entry.title, excerpt: entry.content.slice(0, 1000) };
      if (/人物|角色|人设|档案|persona|character/i.test(label)) roles.push(item);
      if (/地点|地图|学校|医院|location|map/i.test(label)) locations.push(item);
      if (/规则|机制|要求|rule/i.test(label)) rules.push(item);
      if (/变量|schema|initvar|mvu/i.test(label)) variableHints.push(item);
    }
  }
  return {
    schema: SCHEMA_IDS.adapter,
    id: makeId('adapter'),
    createdAt: new Date().toISOString(),
    sourceBooks: books.map(({ name, hash }) => ({ name, hash })),
    mappings: { roles, locations, rules, variableHints },
    unresolved: [],
    confidence: books.length ? 0.55 : 0,
    region: state.region,
  };
}

function entry(uid, title, keys, content, meta) {
  return {
    uid,
    key: keys,
    keysecondary: [],
    comment: title,
    content,
    constant: false,
    selective: true,
    selectiveLogic: 0,
    order: 100,
    position: 0,
    disable: false,
    addMemo: true,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    role: 0,
    extensions: { hypnoos3: meta },
  };
}

export async function buildCompanionPreview({ profile, state, adapter, existing = null }) {
  const pack = getRegionPack(profile.region || state.region);
  const entries = {};
  let uid = 0;
  const owner = { schema: SCHEMA_IDS.companion, owner: 'hypnoos3', profileId: profile.id, adapterId: adapter?.id || null };
  entries[uid] = entry(uid++, '[HypnoOS]运行合同', ['HypnoOS', '催眠手机'], `当前地区模板：${pack.label}\n日期格式：${pack.dateFormat}\n货币：${pack.currency.label}\n此世界书由催眠手机管理；原世界书不会被修改。`, owner);
  for (const role of Object.values(state.roles || {})) {
    entries[uid] = entry(uid++, `[HypnoOS]角色：${role.name}`, [role.name], `姓名：${role.name}\n简介：${role.summary || '未填写'}\n人设：${role.persona || '未填写'}\n自定义变量：${JSON.stringify(role.variables?.extensions || role.variables?.custom || {})}`, { ...owner, roleId: role.id });
    for (const fragment of (Array.isArray(role.worldbookFragments) ? role.worldbookFragments : []).slice(0, 50)) {
      const keys = Array.isArray(fragment.keys) && fragment.keys.length ? fragment.keys.map(String).slice(0, 20) : [role.name];
      entries[uid] = entry(uid++, `[HypnoOS]角色包：${String(fragment.title || role.name).slice(0, 80)}`, keys, inertText(fragment.content), { ...owner, roleId: role.id, fragmentId: String(fragment.id || '') });
    }
  }
  entries[uid] = entry(uid++, '[HypnoOS]地点与日历', pack.locations.map((item) => item.name), `地点：\n${pack.locations.map((item) => `- ${item.name}：${item.description}`).join('\n')}\n\n节假日：${pack.holidays.join('、') || '无预设'}\n课程表：${state.timetable.map((item) => `${item.period || item.课节}:${item.subject || item.科目}`).join('；')}`, owner);
  const entrySnapshots = {};
  for (const [key, value] of Object.entries(entries)) entrySnapshots[key] = await sha256(stableStringify(value));
  const previousMeta = existing?.extensions?.hypnoos3;
  const revision = Math.max(1, Number(previousMeta?.revision || 0) + (existing ? 1 : 0));
  const book = { entries, extensions: { hypnoos3: { ...owner, sourceHashes: adapter?.sourceBooks || [], revision, entrySnapshots } } };
  const generatedHash = await sha256(stableStringify(book));
  const conflicts = [];
  if (existing?.entries) {
    if (previousMeta?.owner !== 'hypnoos3') conflicts.push({ type: 'foreign-book', title: '同名世界书不属于 HypnoOS' });
    const previousSnapshots = isRecord(previousMeta?.entrySnapshots) ? previousMeta.entrySnapshots : {};
    for (const current of entriesOf(existing)) {
      const managed = current?.extensions?.hypnoos3?.owner === 'hypnoos3';
      const key = String(current.uid ?? current.id ?? '');
      if (!managed) {
        conflicts.push({ type: 'foreign-entry', title: current.comment || key });
        continue;
      }
      if (previousSnapshots[key]) {
        const currentHash = await sha256(stableStringify(current));
        const nextHash = entrySnapshots[key];
        if (currentHash !== previousSnapshots[key] && currentHash !== nextHash) {
          conflicts.push({ type: 'managed-entry-modified', title: current.comment || key, uid: key });
        }
      }
    }
  }
  return { book, generatedHash, conflicts, entryCount: Object.keys(entries).length, revision };
}

export async function createCompanionWorldbook(host, { profile, state, adapter, preview }) {
  if (preview.conflicts.length) throw new Error('伴生世界书存在未解决冲突');
  const name = sanitizeName(`HypnoOS-${profile.name}`, 'HypnoOS');
  const names = host.getWorldbookNames();
  if (names.includes(name)) {
    const existing = await host.loadWorldbook(name);
    if (existing?.extensions?.hypnoos3?.owner !== 'hypnoos3') throw new Error('同名世界书不属于 HypnoOS，拒绝覆盖');
  }
  await host.saveWorldbook(name, clone(preview.book));
  return { name, hash: preview.generatedHash };
}
