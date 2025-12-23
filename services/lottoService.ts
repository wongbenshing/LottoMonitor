
import { LottoDraw } from "../types";

// List of multiple proxies to ensure redundancy. 
// Browsers often block CORS requests; these proxies help bypass those restrictions.
const PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://thingproxy.freeboard.io/fetch/"
];

const DLT_URL = "https://datachart.500.com/dlt/history/newinc/history.php?limit=5000&sort=0";

/**
 * Replicates the Python request logic to crawl DLT history.
 * Iterates through available proxies to handle potential 'Failed to fetch' errors.
 */
export const crawlLottoHistory = async (): Promise<LottoDraw[]> => {
  let lastError: Error | null = null;

  for (const proxyBase of PROXIES) {
    try {
      console.log(`Attempting to sync via proxy: ${proxyBase}`);
      
      const targetUrl = `${proxyBase}${encodeURIComponent(DLT_URL)}`;
      
      // Set a reasonable timeout for the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }
      
      const htmlText = await response.text();
      
      // Basic validation: Check if we actually got the data table
      if (!htmlText.includes('cfont2') && !htmlText.includes('t_tr1')) {
        throw new Error("Invalid content received from proxy (possibly blocked or anti-bot triggered)");
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const frontElements = Array.from(doc.querySelectorAll('.cfont2'));
      const rearElements = Array.from(doc.querySelectorAll('.cfont4'));
      const trElements = Array.from(doc.querySelectorAll('tr.t_tr1'));

      const frontNumbers = frontElements.map(el => parseInt(el.textContent || "0")).filter(n => !isNaN(n));
      const rearNumbers = rearElements.map(el => parseInt(el.textContent || "0")).filter(n => !isNaN(n));
      
      const results: LottoDraw[] = [];
      const counts = Math.floor(frontNumbers.length / 5);

      for (let i = 0; i < counts; i++) {
        const row = trElements[i];
        if (!row) continue;

        const tds = row.querySelectorAll('td');
        if (tds.length < 2) continue;

        const drawId = tds[0].textContent?.trim() || "";
        const drawDate = tds[tds.length - 1].textContent?.trim() || "";

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(drawDate)) continue;

        results.push({
          id: drawId,
          date: drawDate,
          front: frontNumbers.slice(i * 5, i * 5 + 5),
          back: rearNumbers.slice(i * 2, i * 2 + 2)
        });
      }

      if (results.length > 0) {
        return results;
      }
      
      throw new Error("No lottery records parsed from the page");

    } catch (error) {
      console.warn(`Proxy ${proxyBase} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to the next proxy in the list
    }
  }

  throw lastError || new Error("Failed to fetch from all available proxies");
};
