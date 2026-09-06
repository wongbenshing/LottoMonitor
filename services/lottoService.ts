import { LottoDraw } from "../types";

const LOCAL_CSV_PATH = "./history.csv";

/**
 * 将数据转换为 CSV 字符串 (用于导出功能)
 */
export const convertToCSV = (data: LottoDraw[]): string => {
  const header = "id,date,f1,f2,f3,f4,f5,b1,b2\n";
  const rows = data.map(d =>
    `${d.id},${d.date},${d.front.join(',')},${d.back.join(',')}`
  ).join('\n');
  return header + rows;
};

/**
 * 解析 CSV 字符串为 LottoDraw 数组
 */
export const parseCSV = (csvText: string): LottoDraw[] => {
  if (!csvText) return [];
  const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('id'));
  return lines.map(line => {
    const parts = line.split(',');
    if (parts.length < 9) return null;
    const row: LottoDraw = {
      id: parts[0],
      date: parts[1],
      front: parts.slice(2, 7).map(n => parseInt(n)),
      back: parts.slice(7, 9).map(n => parseInt(n))
    };
    // v1.2: 新列 p1/p2(一二等奖单注奖金),旧行缺省
    if (parts.length >= 11) {
      row.prize1 = parseInt(parts[9]) || 0;
      row.prize2 = parseInt(parts[10]) || 0;
    }
    // v1.2.5: 官方接口新列 poolAfter,p3..p7(固定奖当期实际金额),空值/旧行 → undefined
    const numOrUndef = (s: string | undefined): number | undefined => {
      if (s === undefined || s.trim() === '') return undefined;
      const v = parseInt(s);
      return isNaN(v) ? undefined : v;
    };
    if (parts.length >= 12) {
      row.poolAfter = numOrUndef(parts[11]);
    }
    if (parts.length >= 17) {
      row.prize3 = numOrUndef(parts[12]) ?? 0;
      row.prize4 = numOrUndef(parts[13]) ?? 0;
      row.prize5 = numOrUndef(parts[14]) ?? 0;
      row.prize6 = numOrUndef(parts[15]) ?? 0;
      row.prize7 = numOrUndef(parts[16]) ?? 0;
    }
    return row;
  }).filter((d): d is LottoDraw => d !== null);
};

/**
 * 获取云端最新的 history.csv 文件
 * 这里的核心是添加 cache-control 或时间戳，确保获取的是最新生成的静态文件
 */
export const fetchServerCSV = async (): Promise<LottoDraw[]> => {
  try {
    // 增加时间戳防止浏览器缓存静态文件
    const cacheBuster = `?t=${Math.floor(Date.now() / 600000)}`; // 每10分钟更新一次缓存阈值
    const response = await fetch(`${LOCAL_CSV_PATH}${cacheBuster}`, {
      cache: 'no-store', // 告诉浏览器不要使用缓存
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) throw new Error("无法连接到云端数据库");
    const text = await response.text();
    return parseCSV(text);
  } catch (e) {
    console.error("Fetch CSV error:", e);
    throw e;
  }
};

/**
 * 向后兼容：Repurpose crawlLottoHistory 为获取服务器 CSV
 */
export const crawlLottoHistory = async (): Promise<LottoDraw[]> => {
  return fetchServerCSV();
};

// 初始加载时使用的辅助方法
export const fetchLocalCSV = fetchServerCSV;
