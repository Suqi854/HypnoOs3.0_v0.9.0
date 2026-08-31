import { appById } from './apps.js';
import { toLegacyVariables } from './contracts.js';
import { getRegionPack } from './regions.js';
import { clone, isRecord } from './utils.js';
import { ArchiveWorldbookService } from './archive-worldbook-service.js';
import { normalizeDatabaseSnapshot } from './database-adapter.js';

function readPath(value, path) {
  return String(path).split('.').reduce((current, key) => current?.[key], value);
}

function writePath(target, path, value) {
  const parts = String(path).split('.');
  let current = target;
  while (parts.length > 1) {
    const key = parts.shift();
    current = current[key] ||= {};
  }
  current[parts[0]] = clone(value);
}

export class AppDataService {
  constructor(host, store) {
    this.host = host;
    this.store = store;
    this.archiveWorldbooks = new ArchiveWorldbookService(host, store);
  }

  readState() { return this.store.state; }

  readAppData(appId) {
    const app = appById(appId);
    if (!app) return null;
    const state = this.readState();
    const data = {};
    for (const path of app.readPaths) writePath(data, path, readPath(state, path));
    const region = getRegionPack(state.region);
    if (appId === 'map' || appId === 'school') data.locations = clone(region.locations);
    if (appId === 'calendar' || appId === 'timetable') {
      data.calendar = { weekdays: clone(region.weekdays), holidays: clone(region.holidays), dateFormat: region.dateFormat };
    }
    return data;
  }

  readLegacyVariables() { return toLegacyVariables(this.readState()); }

  updateLegacyVariables(updater) {
    const current = this.readLegacyVariables();
    const draft = clone(current);
    const candidate = typeof updater === 'function' ? updater(draft) : updater;
    const next = isRecord(candidate) ? candidate : draft;
    this.store.importLegacyVariables(next).catch((error) => console.error('[HypnoOS3] 手机变量写入失败', error));
    return next;
  }

  readMvuData() { return { stat_data: this.readLegacyVariables() }; }

  replaceMvuData(value) {
    const stat = isRecord(value?.stat_data) ? value.stat_data : value;
    return this.store.importLegacyVariables(stat);
  }

  grantCheatResources(value = 99_999_999) {
    const amount = Math.max(0, Math.floor(Number(value) || 0));
    const legacy = this.readLegacyVariables();
    const system = isRecord(legacy.系统) ? legacy.系统 : (legacy.系统 = {});
    for (const key of ['持有零花钱', '星光点', 'MC能量', 'MC能量上限']) system[key] = amount;
    for (const key of ['零花钱', '_MC能量', '_MC能量上限']) {
      if (Object.prototype.hasOwnProperty.call(system, key)) system[key] = amount;
    }
    system.催眠APP订阅等级 = 'VIP6';
    for (const key of ['_催眠APP订阅等级', 'VIP等级', '订阅等级', '订阅', '催眠APP订阅']) {
      if (Object.prototype.hasOwnProperty.call(system, key)) system[key] = 'VIP6';
    }
    return this.store.importLegacyVariables(legacy);
  }

  getWorldbookNames() { return this.host.getWorldbookNames(); }
  getCharacterWorldbookNames() { return this.host.getCharacterWorldbookNames(); }
  getWorldbook(name) { return this.host.loadWorldbook(name); }
  getArchiveWorldbookOptions() { return this.archiveWorldbooks.options(); }
  configureArchiveWorldbook(options) { return this.archiveWorldbooks.configure(options); }
  async getDatabaseSnapshot() {
    return normalizeDatabaseSnapshot(await this.host.readDatabaseSnapshot?.());
  }
  syncDatabaseState() { return this.store.syncDatabaseRuntimeState(); }
  async syncArchiveFromLatestReply(options) {
    if (this.host.hasDatabaseRuntime?.()) {
      await this.store.syncDatabaseRuntimeState('database-dialogue-round');
      const snapshot = await this.getDatabaseSnapshot();
      return { ok: true, skipped: true, reason: 'database-source', sheetCount: snapshot.sheets.length };
    }
    return this.archiveWorldbooks.syncLatestReply(options);
  }
  activateArchiveWorldbookRules() { return this.archiveWorldbooks.activateRules(); }
  deactivateArchiveWorldbookRules() { return this.archiveWorldbooks.deactivateRules(); }
}
