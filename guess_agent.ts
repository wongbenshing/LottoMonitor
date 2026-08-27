// 竞猜后端定时智能体
// 每日 10:00:下期竞猜序列为空 → AI 选号(默认 2 组)写入 guess_records.json
// 每 5 分钟:history.csv 有新开奖 → 验证 pending 序列并回填奖金
// 运行: npx tsx guess_agent.ts (cwd = 项目根,与 lotto_update.py 同款 nohup 部署)
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GuessRecord, GuessParams, LottoDraw } from './types';
import { nextOpenDate, nextPeriodId, verifyRecord, computeBestParams, addPick, removePick } from './services/guessCore';
import { parseCSV } from './services/lottoService';

// node 运行时 process.env.API_KEY 需手动从 .env.local 加载(与 vite define 行为一致: ← GEMINI_API_KEY)
// ⚠ 必须在 import deepseekService 之前执行:其模块顶层 const API_KEY = process.env.API_KEY 在 import 时求值
try {
  const envRaw = readFileSync('.env.local', 'utf8');
  const env: Record<string, string> = {};
  for (const line of envRaw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  process.env.API_KEY = env.GEMINI_API_KEY ?? env.API_KEY ?? process.env.API_KEY ?? '';
} catch {
  console.warn('[guess] 未找到 .env.local,API_KEY 可能为空');
}

// 动态导入:确保 API_KEY 已注入
const { getSmartAnalysis } = await import('./services/deepseekService');

const RECORDS_FILE = 'guess_records.json'; // 项目根,nginx alias 直读
const CSV_FILE = 'history.csv';            // 项目根(nginx alias 直读的就是它)

let lastDailyRunDate = '';

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadRecords(): GuessRecord[] {
  try { return JSON.parse(readFileSync(RECORDS_FILE, 'utf8')) as GuessRecord[]; }
  catch { return []; }
}

function saveRecords(records: GuessRecord[]): void {
  writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function loadHistory(): LottoDraw[] {
  try { return parseCSV(readFileSync(CSV_FILE, 'utf8')); }
  catch { return []; }
}

/** 每日 10:00:下期序列为空 → AI 选号(count=2)写入 */
async function dailyPick(now: Date): Promise<void> {
  const today = fmtDate(now);
  if (lastDailyRunDate === today) return;
  const targetDate = nextOpenDate(now);
  if (loadRecords().some(r => r.targetDate === targetDate)) return; // 已有下期序列
  lastDailyRunDate = today; // 先记账防并发重入

  const history = loadHistory();
  if (history.length === 0) throw new Error('history 为空');
  const params = computeBestParams(history);
  const res = await getSmartAnalysis(
    history, params.sumMin, params.sumMax, params.rangeMin, params.rangeMax,
    params.consecutive, params.frontRepeat, params.backRepeat, params.odd,
    2, // 默认 2 组
  );
  const picks = (res.recommendations ?? []).filter(r => Array.isArray(r) && r.length === 7);
  if (picks.length === 0) { lastDailyRunDate = ''; throw new Error('AI 返回空选号'); }

  const rec: GuessRecord = {
    targetDate,
    periodId: nextPeriodId(history[0].id),
    picks,
    params,
    createdAt: now.toISOString(),
    status: 'pending',
  };
  saveRecords([...loadRecords(), rec]);
  console.log(`[guess] ${today} 10:00 竞猜已生成:${targetDate}(${rec.periodId}) ${picks.length}组: ${JSON.stringify(picks)}`);
}

/** 每 5 分钟:新开奖验证(history.csv 中 targetDate 已开奖的 pending → verified) */
function verifyPending(history: LottoDraw[]): void {
  const records = loadRecords();
  let changed = false;
  const updated = records.map(r => {
    if (r.status !== 'pending') return r;
    const draw = history.find(d => d.date === r.targetDate);
    if (!draw) return r;
    changed = true;
    const v = verifyRecord(r, draw);
    console.log(`[guess] 验证 ${r.targetDate}: 开奖${draw.id}, 中奖${v.results?.filter(x => x.tier).length ?? 0}/${v.picks.length}组, 奖金¥${v.totalPrize ?? 0}`);
    return v;
  });
  if (changed) saveRecords(updated);
}

// 主循环:每 30s 检查一次(10:00 窗口触发选号;每 5 分钟验证开奖)
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 10 && now.getMinutes() < 2) {
    dailyPick(now).catch(e => console.error('[guess] 选号失败(下次轮询重试):', e));
  }
  if (now.getMinutes() % 5 === 0) {
    try { verifyPending(loadHistory()); } catch (e) { console.error('[guess] 验证失败:', e); }
  }
}, 30_000);

// ============ HTTP API(前端【加入竞猜】/【移出竞猜】写入通道)============
const API_PORT = 3012;
const EMPTY_PARAMS: GuessParams = {
  sumMin: 0, sumMax: 0, rangeMin: 0, rangeMax: 0,
  consecutive: [], frontRepeat: [], backRepeat: [], odd: [],
};

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) reject(new Error('body too large')); });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) as Record<string, unknown> : {}); }
      catch (e) { reject(e); }
    });
  });
}

function send(res: ServerResponse, code: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** 创建时回填 periodId(从 history 最新期号推算),返回最新记录数组 */
function fillPeriodId(records: GuessRecord[]): GuessRecord[] {
  const missing = records.find(r => r.periodId === '' && r.status === 'pending');
  if (!missing) return records;
  const hist = loadHistory();
  if (hist.length === 0) return records;
  return records.map(r => r.targetDate === missing.targetDate
    ? { ...r, periodId: nextPeriodId(hist[0].id) } : r);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/api/guess/add') {
      const body = await readJson(req);
      const targetDate = typeof body.targetDate === 'string' && body.targetDate
        ? body.targetDate : nextOpenDate();
      const numbers = Array.isArray(body.numbers) ? (body.numbers as unknown[]).map(Number) : null;
      if (!numbers || numbers.length !== 7) {
        return send(res, 400, { ok: false, error: 'numbers 必须为 7 个数字' });
      }
      try {
        const params = (body.params && typeof body.params === 'object')
          ? body.params as GuessParams : EMPTY_PARAMS;
        const { records: next, pickIndex, alreadyExists } =
          addPick(loadRecords(), targetDate, numbers, params);
        const filled = fillPeriodId(next);
        saveRecords(filled);
        const rec = filled.find(r => r.targetDate === targetDate);
        return send(res, 200, {
          ok: true, targetDate, pickIndex,
          picks: rec?.picks.length ?? 0, alreadyExists,
        });
      } catch (e) {
        return send(res, 409, { ok: false, error: (e as Error).message });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/guess/remove') {
      const body = await readJson(req);
      const targetDate = String(body.targetDate ?? '');
      const pickIndex = Number(body.pickIndex);
      if (!targetDate || Number.isNaN(pickIndex)) {
        return send(res, 400, { ok: false, error: 'targetDate/pickIndex 必填' });
      }
      try {
        const { records: next, removed } = removePick(loadRecords(), targetDate, pickIndex);
        saveRecords(next);
        const rec = next.find(r => r.targetDate === targetDate);
        return send(res, 200, { ok: true, removed, picks: rec?.picks.length ?? 0 });
      } catch (e) {
        return send(res, 409, { ok: false, error: (e as Error).message });
      }
    }
    return send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    return send(res, 400, { ok: false, error: (e as Error).message });
  }
});

server.listen(API_PORT, () => {
  console.log(`[guess] API 服务已启动 :${API_PORT} (/api/guess/add, /api/guess/remove)`);
});

console.log(`[guess] 竞猜智能体已启动 ${new Date().toISOString()}:每日10:00自动选号,每5分钟验证开奖, 数据文件=${RECORDS_FILE}`);
