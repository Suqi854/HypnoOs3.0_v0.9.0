import { SCHEMA_IDS } from './constants.js';

const define = (id, label, category, readPaths, writePaths = [], capabilities = [], fallback = '显示空状态并引导配置') => Object.freeze({
  schema: SCHEMA_IDS.app,
  id,
  label,
  category,
  readPaths,
  writePaths,
  capabilities,
  fallback,
});

export const PHONE_APPS = Object.freeze([
  define('registration', '使用者登记', 'system', ['roles', 'custom.user'], ['roles', 'custom.user']),
  define('gambling', '赌博', 'world', ['resources.money'], ['resources.money'], ['model-optional']),
  define('hypnosis', '催眠APP', 'control', ['roles', 'resources', 'hypnosis'], ['resources', 'hypnosis', 'operationQueue']),
  define('profile-female', '女性档案', 'social', ['roles'], ['roles'], ['avatars']),
  define('profile-male', '男性档案', 'social', ['roles'], ['roles'], ['avatars']),
  define('calendar', '日历', 'world', ['time'], ['time']),
  define('clock', '时钟', 'world', ['time'], ['time']),
  define('achievements', '成就和任务', 'social', ['achievements', 'tasks'], ['achievements', 'tasks', 'resources']),
  define('inventory', '库存', 'control', ['inventory'], ['inventory']),
  define('mc-anon', '混沌心海', 'social', ['roles', 'custom.mchan'], ['operationQueue'], ['model-optional']),
  define('map', '地图', 'world', ['location'], ['location']),
  define('camera', '照相', 'system', ['roles'], ['roles'], ['avatars']),
  define('wallpaper', '墙纸', 'system', ['custom.wallpaper'], ['custom.wallpaper']),
  define('encounter', '邂逅', 'social', ['roles', 'location'], ['roles', 'operationQueue'], ['model-optional']),
  define('help', '帮助', 'system', [], []),
  define('settings', '设置', 'system', ['custom'], ['custom']),
  define('operation-queue', '操作队列', 'control', ['operationQueue'], ['operationQueue']),
  define('database', '数据库', 'system', ['custom.databaseSource', 'roles', 'inventory', 'tasks'], [], ['database-optional'], '显示数据库未连接状态'),
  define('school', '学校', 'world', ['location', 'timetable'], ['location']),
  define('timetable', '课程表', 'world', ['timetable'], ['timetable']),
  define('work', '打工', 'world', ['work', 'time', 'location'], ['work', 'resources', 'operationQueue'], ['model-optional']),
  define('dispatch', '派遣', 'world', ['dispatches', 'roles'], ['dispatches', 'operationQueue']),
  define('monitor', '监控', 'world', ['roles', 'location'], ['operationQueue']),
  define('cheat', '作弊', 'control', ['custom.cheat'], ['custom.cheat']),
]);

export function appById(id) {
  return PHONE_APPS.find((app) => app.id === id) || null;
}
