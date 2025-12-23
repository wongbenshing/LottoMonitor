
import React from 'react';

export const PRIZE_TIERS = [
  { tier: '1', name: '一等奖', condition: '5+2' },
  { tier: '2', name: '二等奖', condition: '5+1' },
  { tier: '3', name: '三等奖', condition: '5+0' },
  { tier: '4', name: '四等奖', condition: '4+2' },
  { tier: '5', name: '五等奖', condition: '4+1' },
  { tier: '6', name: '六等奖', condition: '3+2' },
  { tier: '7', name: '七等奖', condition: '4+0' },
  { tier: '8', name: '八等奖', condition: '3+1/2+2' },
  { tier: '9', name: '九等奖', condition: '3+0/2+1/1+2/0+2' },
];

// Mock initial data to ensure the app works immediately
export const INITIAL_DATA = [
  { id: "24025", date: "2024-03-04", front: [1, 5, 10, 20, 30], back: [2, 11] },
  { id: "24024", date: "2024-03-02", front: [3, 8, 15, 24, 33], back: [6, 7] },
  { id: "24023", date: "2024-02-28", front: [2, 11, 19, 26, 35], back: [3, 10] },
  { id: "24022", date: "2024-02-26", front: [7, 13, 22, 29, 31], back: [1, 8] },
  { id: "24021", date: "2024-02-24", front: [4, 9, 16, 25, 34], back: [5, 12] },
];
