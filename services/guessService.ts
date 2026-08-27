import { GuessRecord } from '../types';
import type { GuessParams } from '../types';
import { parseGuessJson } from './guessCore';

const GUESS_URL = './guess_records.json';
const API_BASE = './api/guess';

/**
 * 获取竞猜记录(nginx alias 直读 guess_records.json)
 * 带 10 分钟 cache-buster,与 fetchServerCSV 同策略
 */
export const fetchGuessRecords = async (): Promise<GuessRecord[]> => {
  try {
    const cacheBuster = `?t=${Math.floor(Date.now() / 600000)}`;
    const response = await fetch(`${GUESS_URL}${cacheBuster}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return [];
    return parseGuessJson(await response.text());
  } catch {
    return [];
  }
};

/** 加入一组到下期竞猜(经 guess_agent API :3012 写入服务器) */
export const addPickToGuess = async (
  numbers: number[], params?: GuessParams, targetDate?: string
): Promise<{ ok: boolean; targetDate?: string; pickIndex?: number; picks?: number; alreadyExists?: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers, params, targetDate }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};

/** 移除一组竞猜(经 guess_agent API :3012 写入服务器) */
export const removePickFromGuess = async (
  targetDate: string, pickIndex: number
): Promise<{ ok: boolean; removed?: boolean; picks?: number; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate, pickIndex }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};
