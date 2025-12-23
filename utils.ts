
import { LottoDraw, PrizeResult } from './types';

export const checkPrize = (userFront: number[], userBack: number[], draw: LottoDraw): string | null => {
  const frontMatch = userFront.filter(n => draw.front.includes(n)).length;
  const backMatch = userBack.filter(n => draw.back.includes(n)).length;

  if (frontMatch === 5 && backMatch === 2) return '1';
  if (frontMatch === 5 && backMatch === 1) return '2';
  if (frontMatch === 5 && backMatch === 0) return '3';
  if (frontMatch === 4 && backMatch === 2) return '4';
  if (frontMatch === 4 && backMatch === 1) return '5';
  if (frontMatch === 3 && backMatch === 2) return '6';
  if (frontMatch === 4 && backMatch === 0) return '7';
  if ((frontMatch === 3 && backMatch === 1) || (frontMatch === 2 && backMatch === 2)) return '8';
  if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) || (frontMatch === 1 && backMatch === 2) || (frontMatch === 0 && backMatch === 2)) return '9';

  return null;
};

export const calculateHistoricalPrizes = (userFront: number[], userBack: number[], history: LottoDraw[]): PrizeResult[] => {
  const results: Record<string, PrizeResult> = {
    '1': { tier: '1', name: '一等奖', count: 0, dates: [] },
    '2': { tier: '2', name: '二等奖', count: 0, dates: [] },
    '3': { tier: '3', name: '三等奖', count: 0, dates: [] },
    '4': { tier: '4', name: '四等奖', count: 0, dates: [] },
    '5': { tier: '5', name: '五等奖', count: 0, dates: [] },
    '6': { tier: '6', name: '六等奖', count: 0, dates: [] },
    '7': { tier: '7', name: '七等奖', count: 0, dates: [] },
    '8': { tier: '8', name: '八等奖', count: 0, dates: [] },
    '9': { tier: '9', name: '九等奖', count: 0, dates: [] },
  };

  history.forEach(draw => {
    const tier = checkPrize(userFront, userBack, draw);
    if (tier && results[tier]) {
      results[tier].count++;
      results[tier].dates.push(draw.date);
    }
  });

  return Object.values(results);
};
