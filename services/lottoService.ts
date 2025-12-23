
import { LottoDraw } from "../types";

const PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/"
];

// User can replace this with their actual raw GitHub CSV URL
const REMOTE_CSV_URL = ""; 

const TRIAL_LIMITS = [2000, 1000, 500, 100];

/**
 * Converts LottoDraw array to a CSV string
 */
export const convertToCSV = (data: LottoDraw[]): string => {
  const header = "id,date,f1,f2,f3,f4,f5,b1,b2\n";
  const rows = data.map(d => 
    `${d.id},${d.date},${d.front.join(',')},${d.back.join(',')}`
  ).join('\n');
  return header + rows;
};

/**
 * Parses a CSV string into LottoDraw array
 */
export const parseCSV = (csvText: string): LottoDraw[] => {
  const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('id'));
  return lines.map(line => {
    const parts = line.split(',');
    if (parts.length < 9) return null;
    return {
      id: parts[0],
      date: parts[1],
      front: parts.slice(2, 7).map(n => parseInt(n)),
      back: parts.slice(7, 9).map(n => parseInt(n))
    };
  }).filter((d): d is LottoDraw => d !== null);
};

/**
 * Fetches historical data from a remote CSV file (e.g. GitHub)
 */
export const fetchRemoteHistory = async (url: string = REMOTE_CSV_URL): Promise<LottoDraw[]> => {
  if (!url) return [];
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const text = await response.text();
    return parseCSV(text);
  } catch (e) {
    console.error("Remote CSV fetch failed", e);
    return [];
  }
};

/**
 * Fetches and parses lottery data from 500.com with a specific limit.
 */
async function fetchWithLimit(limit: number, proxyBase: string): Promise<LottoDraw[]> {
  const url = `https://datachart.500.com/dlt/history/newinc/history.php?limit=${limit}&sort=0`;
  const targetUrl = `${proxyBase}${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); 

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Status ${response.status}`);
    
    const htmlText = await response.text();
    if (!htmlText.includes('t_tr1')) throw new Error("No table rows found");

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const trElements = Array.from(doc.querySelectorAll('tr.t_tr1'));
    const results: LottoDraw[] = [];

    trElements.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 9) return;

      const drawId = tds[0].textContent?.trim() || "";
      const front = [
        parseInt(tds[1].textContent || "0"),
        parseInt(tds[2].textContent || "0"),
        parseInt(tds[3].textContent || "0"),
        parseInt(tds[4].textContent || "0"),
        parseInt(tds[5].textContent || "0")
      ];
      const back = [
        parseInt(tds[6].textContent || "0"),
        parseInt(tds[7].textContent || "0")
      ];
      
      let drawDate = "";
      for (let i = tds.length - 1; i >= 0; i--) {
        const val = tds[i].textContent?.trim() || "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          drawDate = val;
          break;
        }
      }

      if (drawId && drawDate && !front.some(isNaN) && !back.some(isNaN)) {
        results.push({ id: drawId, date: drawDate, front, back });
      }
    });

    return results;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/**
 * Automatically attempts to find the largest working limit and syncs all records.
 */
export const crawlLottoHistory = async (): Promise<LottoDraw[]> => {
  let lastError: Error | null = null;

  for (const proxy of PROXIES) {
    for (const limit of TRIAL_LIMITS) {
      try {
        const data = await fetchWithLimit(limit, proxy);
        if (data.length > 5) {
          return data;
        }
      } catch (err) {
        lastError = err as Error;
      }
    }
  }

  throw lastError || new Error("All sync attempts failed");
};
