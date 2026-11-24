#!/usr/bin/env python3.10
"""history.csv 奖金字段历史回填(v1.3 P0)

背景:history.csv 的 p1/p2/pool/p3~p7 只在 2026-06-27(26072)之后才被 lotto_update.py 抓到,
2635 期里 97.6% 的期数奖金字段为 0 —— 导致任何长期 EV / 奖池闸门回测都无法进行。

本脚本翻页拉取体彩官方历史接口(全量约 2952 期),幂等回填:
  - CSV 缺失的期号 → 整行新增(开奖号 + 奖金字段)
  - 已有期号 → 只补空值(0),绝不覆盖已有的非零值
  - 新规期(期号>=26014 或 日期>=2026-02-02):p1,p2,pool,p3~p7 全补
  - 旧规期(9 奖级):只补 p1,p2,pool;p3~p7 保持 0(旧档位语义与新规不同,填入会污染 EV 分析)

用法:
  /usr/local/bin/python3.10 lotto_backfill.py            # 回填并写盘
  /usr/local/bin/python3.10 lotto_backfill.py --dry-run  # 只统计不写盘
"""
import fcntl
import os
import sys
from datetime import datetime

import pandas as pd
import requests

CSV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'history.csv')
API_URL = "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Referer': 'https://www.sporttery.cn/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}
COLS = ['id', 'date', 'f1', 'f2', 'f3', 'f4', 'f5', 'b1', 'b2',
        'p1', 'p2', 'pool', 'p3', 'p4', 'p5', 'p6', 'p7']
NEW_RULE_MIN_ID = 26014
NEW_RULE_START_DATE = '2026-02-02'
PAGE_SIZE = 100


def parse_money(text):
    """'6,840,926' / 6840926 / '---' → int; 异常 → 0"""
    if text is None:
        return 0
    try:
        return int(float(str(text).replace(',', '').strip()))
    except (ValueError, AttributeError):
        return 0


def is_new_rule(draw_id: str, date: str) -> bool:
    try:
        if int(draw_id) >= NEW_RULE_MIN_ID:
            return True
    except ValueError:
        pass
    return date >= NEW_RULE_START_DATE


def fetch_page(page_no: int):
    params = {'gameNo': '85', 'provinceId': '0', 'pageSize': str(PAGE_SIZE),
              'isVerify': '1', 'pageNo': str(page_no)}
    r = requests.get(API_URL, params=params, headers=HEADERS, timeout=25)
    r.raise_for_status()
    value = (r.json().get('value') or {})
    return value.get('list') or [], int(value.get('pages') or 0)


def parse_item(item):
    """接口单期 → dict(列名对齐 COLS);字段异常返回 None"""
    draw_id = str(item.get('lotteryDrawNum', '')).strip()
    date = str(item.get('lotteryDrawTime', ''))[:10]
    nums = [int(x) for x in str(item.get('lotteryDrawResult', '')).split() if x.strip()]
    if not draw_id or not date or len(nums) != 7:
        return None
    front, back = nums[:5], nums[5:7]
    new_rule = is_new_rule(draw_id, date)

    levels = {}
    for pl in item.get('prizeLevelList') or []:
        name = str(pl.get('prizeLevel', ''))
        if '追加' in name:
            continue  # 追加奖级不计入基本投注单注奖金
        levels[name] = parse_money(pl.get('stakeAmount'))

    row = {
        'id': draw_id, 'date': date,
        'f1': front[0], 'f2': front[1], 'f3': front[2], 'f4': front[3], 'f5': front[4],
        'b1': back[0], 'b2': back[1],
        'p1': levels.get('一等奖', 0), 'p2': levels.get('二等奖', 0),
        'pool': parse_money(item.get('poolBalanceAfterdraw')),
        'p3': 0, 'p4': 0, 'p5': 0, 'p6': 0, 'p7': 0,
    }
    if new_rule:  # 旧规期不填三~七等:9 档位的语义与新规 7 档不同
        row['p3'] = levels.get('三等奖', 0)
        row['p4'] = levels.get('四等奖', 0)
        row['p5'] = levels.get('五等奖', 0)
        row['p6'] = levels.get('六等奖', 0)
        row['p7'] = levels.get('七等奖', 0)
    return row


def fetch_all():
    rows, pages = [], None
    page = 1
    while True:
        lst, total_pages = fetch_page(page)
        if pages is None:
            pages = total_pages
            print(f"[抓取] 官方历史共 {pages} 页 × {PAGE_SIZE} 期")
        if not lst:
            break
        rows.extend(x for x in (parse_item(i) for i in lst) if x)
        print(f"  第 {page}/{pages} 页 → 累计 {len(rows)} 期")
        if pages and page >= pages:
            break
        page += 1
    return rows


def norm_id(raw) -> str:
    """期号归一:官方早期带前导零('09105'),CSV 存无前导零('9105') → 统一成无前导零字符串,否则同一期会被当成两期重复插入"""
    s = str(raw).strip()
    try:
        return str(int(s))
    except ValueError:
        return s


def fill(combined: pd.DataFrame, official: pd.DataFrame):
    """幂等回填:缺失期新增,已有期只补 0 值。返回 (df, 统计)"""
    combined['id'] = combined['id'].map(norm_id)
    combined = combined.drop_duplicates(subset=['id'], keep='first').set_index('id', drop=False)
    stat = {'added': 0, 'filled': {c: 0 for c in COLS if c not in ('id', 'date')}}

    for _, r in official.iterrows():
        did = norm_id(r['id'])
        if did not in combined.index:
            combined.loc[did] = r
            stat['added'] += 1
            continue
        for c in COLS:
            if c in ('id', 'date', 'f1', 'f2', 'f3', 'f4', 'f5', 'b1', 'b2'):
                continue
            old = combined.at[did, c] if c in combined.columns else 0
            old_v = 0 if pd.isna(old) else int(float(old))
            new_v = int(r[c])
            if old_v == 0 and new_v > 0:
                combined.at[did, c] = new_v
                stat['filled'][c] += 1
    return combined.reset_index(drop=True), stat


def report(df: pd.DataFrame):
    ids = df['id'].astype(str)
    new_rule = df[(ids.astype(int) >= NEW_RULE_MIN_ID) | (df['date'] >= NEW_RULE_START_DATE)]
    print("\n[完整率]")
    print(f"  总期数 {len(df)}  (新规 {len(new_rule)} 期 / 旧规 {len(df) - len(new_rule)} 期)")
    for label, sub in (('新规期', new_rule), ('全历史', df)):
        line = []
        for c in ('p1', 'p2', 'pool', 'p3', 'p4', 'p5', 'p6', 'p7'):
            nz = int((sub[c].fillna(0) > 0).sum())
            line.append(f"{c}={nz}/{len(sub)}({nz / len(sub) * 100:.0f}%)")
        print(f"  {label}: " + ' '.join(line))


def main(dry_run=False):
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{now}] history.csv 奖金字段回填(新规 p1~p7/pool,旧规 p1/p2/pool)")

    if not os.path.exists(CSV_FILE):
        print(f"未找到 {CSV_FILE}")
        return 1
    old = pd.read_csv(CSV_FILE)
    for c in COLS:
        if c not in old.columns:
            old[c] = 0
    old = old[COLS]
    print(f"[读取] 现有 {len(old)} 期 ({old['date'].min()} ~ {old['date'].max()})")
    report(old)

    official_rows = fetch_all()
    if not official_rows:
        print("官方接口无数据,中止(不改动 CSV)")
        return 1
    official = pd.DataFrame(official_rows)[COLS]
    official['id'] = official['id'].astype(str)
    # 官方 newest first;同一期多次出现时保留第一条
    official = official.drop_duplicates(subset=['id'], keep='first')

    lock_path = CSV_FILE + '.lock'
    lock_file = open(lock_path, 'w')
    fcntl.flock(lock_file, fcntl.LOCK_EX)  # 防止与 pm2 lotto-update 并发写
    try:
        merged, stat = fill(old.copy(), official)
        merged['id'] = merged['id'].astype(str)
        merged['date'] = merged['date'].astype(str)
        for c in COLS[2:]:
            merged[c] = pd.to_numeric(merged[c], errors='coerce').fillna(0).astype('int64')
        merged['_ord'] = merged['id'].astype(int)
        merged = merged.sort_values('_ord', ascending=False).drop(columns=['_ord'])
        merged = merged[COLS]

        print(f"\n[回填] 新增期数 {stat['added']}  字段补齐: "
              + ' '.join(f"{k}+{v}" for k, v in stat['filled'].items() if v))
        report(merged)

        if dry_run:
            print("\n[dry-run] 未写盘")
            return 0
        backup = f"{CSV_FILE}.bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        old.to_csv(backup, index=False, encoding='utf-8')  # 备份回填前的原文件
        merged.to_csv(CSV_FILE, index=False, encoding='utf-8')
        print(f"\n[写盘] {CSV_FILE} 已更新,备份 {backup}")
    finally:
        fcntl.flock(lock_file, fcntl.LOCK_UN)
        lock_file.close()
        try:
            os.remove(lock_path)
        except OSError:
            pass
    return 0


if __name__ == '__main__':
    sys.exit(main(dry_run='--dry-run' in sys.argv))
