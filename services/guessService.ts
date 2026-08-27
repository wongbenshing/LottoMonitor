import { GuessRecord } from '../types';
import { parseGuessJson } from './guessCore';

const GUESS_URL = './guess_records.json';

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
