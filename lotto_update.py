import requests
from bs4 import BeautifulSoup
import pandas as pd
import os
import re
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

# 配置
CSV_FILE = os.getcwd() + os.sep + 'history.csv'
# v1.2.5: 数据源切换为体彩官方接口(webapi.sporttery.cn)
# 返回每期: 开奖号码 + 一二等单注奖金 + 奖池 + 3~7等固定奖单注金额(2026新规后随奖池分档)
API_URL = "https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Referer': 'https://www.sporttery.cn/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9'
}


def parse_money(text):
    """'6,840,926' / 6840926 / 692723356.75 → int; 异常 → 0"""
    if text is None:
        return 0
    try:
        return int(float(str(text).replace(',', '').strip()))
    except (ValueError, AttributeError):
        return 0


def fetch_latest_draws(page_size=30):
    """从体彩官方接口抓取最近 page_size 期开奖(含各奖级单注奖金与奖池)"""
    print(f"[{datetime.now()}] 正在从体彩官方接口抓取...")
    try:
        params = {
            'gameNo': '85',          # 超级大乐透
            'provinceId': '0',
            'pageSize': str(page_size),
            'isVerify': '1',
            'pageNo': '1',
        }
        response = requests.get(API_URL, params=params, headers=HEADERS, timeout=20)
        if response.status_code != 200:
            print(f"请求失败，状态码: {response.status_code}")
            return None

        data = response.json()
        lst = (data.get('value') or {}).get('list') or []
        if not lst:
            print(f"接口返回空列表: {str(data)[:200]}")
            return None

        new_data = []
        for item in lst:
            draw_id = str(item.get('lotteryDrawNum', '')).strip()
            draw_time = str(item.get('lotteryDrawTime', ''))[:10]  # 'YYYY-MM-DD'
            nums = [int(x) for x in str(item.get('lotteryDrawResult', '')).split() if x.strip()]
            front, back = nums[:5], nums[5:7]
            if not draw_id or not draw_time or len(front) != 5 or len(back) != 2:
                print(f"[跳过] 字段异常: id={draw_id} date={draw_time} result={nums}")
                continue

            # 奖级金额: prizeLevelList 中 prizeLevel 为中文奖级名;跳过追加(prizeLevelRj)
            prize = {'p1': 0, 'p2': 0, 'p3': 0, 'p4': 0, 'p5': 0, 'p6': 0, 'p7': 0}
            for pl in item.get('prizeLevelList') or []:
                level = str(pl.get('prizeLevel', ''))
                amount = parse_money(pl.get('stakeAmount'))
                if level == '一等奖':
                    prize['p1'] = amount
                elif level == '二等奖':
                    prize['p2'] = amount
                elif level == '三等奖':
                    prize['p3'] = amount
                elif level == '四等奖':
                    prize['p4'] = amount
                elif level == '五等奖':
                    prize['p5'] = amount
                elif level == '六等奖':
                    prize['p6'] = amount
                elif level == '七等奖':
                    prize['p7'] = amount

            new_data.append({
                'id': draw_id,
                'date': draw_time,
                'f1': front[0], 'f2': front[1], 'f3': front[2], 'f4': front[3], 'f5': front[4],
                'b1': back[0], 'b2': back[1],
                'p1': prize['p1'], 'p2': prize['p2'],
                'pool': parse_money(item.get('poolBalanceAfterdraw')),
                'p3': prize['p3'], 'p4': prize['p4'], 'p5': prize['p5'], 'p6': prize['p6'], 'p7': prize['p7'],
            })

        return pd.DataFrame(new_data)
    except Exception as e:
        print(f"爬虫执行异常: {e}")
        return None


def update_csv():
    """读取、合并、去重并保存 CSV"""
    new_df = fetch_latest_draws()
    if new_df is None or new_df.empty:
        print("未获取到新数据，跳过本次更新。")
        return

    if os.path.exists(CSV_FILE):
        try:
            old_df = pd.read_csv(CSV_FILE)
            # 合并新旧数据
            combined_df = pd.concat([new_df, old_df], ignore_index=True)
        except Exception as e:
            print(f"读取旧 CSV 失败: {e}")
            combined_df = new_df
    else:
        combined_df = new_df

    # 根据 ID 去重，保留第一次出现的（即新抓取的，虽然理论上数据应该一致）
    combined_df['id'] = combined_df['id'].astype(str)
    combined_df.drop_duplicates(subset=['id'], keep='first', inplace=True)

    # v1.2: 旧 CSV 无 p1/p2 列时补齐(新数据 concat 后 NaN → 0)
    if 'p1' not in combined_df.columns:
        combined_df['p1'] = 0
    if 'p2' not in combined_df.columns:
        combined_df['p2'] = 0
    combined_df = combined_df.fillna({'p1': 0, 'p2': 0})
    combined_df['p1'] = combined_df['p1'].astype(int)
    combined_df['p2'] = combined_df['p2'].astype(int)

    # 按照期号倒序排列
    combined_df['id_int'] = combined_df['id'].astype(int)
    combined_df.sort_values(by='id_int', ascending=False, inplace=True)
    combined_df.drop(columns=['id_int'], inplace=True)

    # 保存
    combined_df.to_csv(CSV_FILE, index=False, encoding='utf-8')
    print(f"[{datetime.now()}] 更新成功！当前数据库总量: {len(combined_df)} 期。")


def start_scheduler():
    """启动定时任务"""
    scheduler = BlockingScheduler()

    # 每天 22:30, 23:00, 23:30, 00:00 执行
    # 注意：00:00 对应 hour=0, minute=0
    scheduler.add_job(update_csv, 'cron', hour='22', minute='30', id='task_2230')
    scheduler.add_job(update_csv, 'cron', hour='23', minute='00', id='task_2300')
    scheduler.add_job(update_csv, 'cron', hour='23', minute='30', id='task_2330')
    scheduler.add_job(update_csv, 'cron', hour='0', minute='0', id='task_0000')

    print("--- 大乐透后端同步脚本已启动 ---")
    print("监控时间点: 22:30, 23:00, 23:30, 00:00")

    # 启动时先执行一次，确保数据是最新的
    update_csv()

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    update_csv()
    start_scheduler()
