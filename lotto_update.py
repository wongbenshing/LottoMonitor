import requests
from bs4 import BeautifulSoup
import pandas as pd
import os
import re
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

# 配置
CSV_FILE = os.getcwd() + os.sep + 'history.csv'
TARGET_URL = "https://datachart.500.com/dlt/history/newinc/history.php?limit=50&sort=0"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}


def parse_money(td_text):
    """'6,840,926' → 6840926; '--'/''/异常 → 0"""
    try:
        return int(td_text.replace(',', '').strip())
    except (ValueError, AttributeError):
        return 0


def fetch_latest_draws():
    """从 500.com 抓取最新的开奖数据"""
    print(f"[{datetime.now()}] 正在启动爬虫任务...")
    try:
        response = requests.get(TARGET_URL, headers=HEADERS, timeout=15)
        response.encoding = 'utf-8'
        if response.status_code != 200:
            print(f"请求失败，状态码: {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, 'html.parser')
        rows = soup.select('tr.t_tr1')

        new_data = []
        for row in rows[1:]:
            tds = row.find_all('td')
            if len(tds) < 9:
                continue

            # 1. 提取期号
            draw_id = tds[0].get_text(strip=True)

            # 2. 提取前区 5 个数字
            front = [int(tds[i].get_text(strip=True)) for i in range(1, 6)]

            # 3. 提取后区 2 个数字
            back = [int(tds[i].get_text(strip=True)) for i in range(6, 8)]

            # 4. 提取日期 (寻找 YYYY-MM-DD 格式)
            draw_date = ""
            for td in tds:
                text = td.get_text(strip=True)
                if re.match(r'^\d{4}-\d{2}-\d{2}$', text):
                    draw_date = text
                    break

            if draw_id and draw_date:
                # v1.2: 抓取一二等奖单注奖金(tds 索引: 9=一等注数 10=一等奖金 11=二等注数 12=二等奖金)
                prize1 = parse_money(tds[10].get_text(strip=True)) if len(tds) > 12 else 0
                prize2 = parse_money(tds[12].get_text(strip=True)) if len(tds) > 12 else 0
                new_data.append({
                    'id': draw_id,
                    'date': draw_date,
                    'f1': front[0], 'f2': front[1], 'f3': front[2], 'f4': front[3], 'f5': front[4],
                    'b1': back[0], 'b2': back[1],
                    'p1': prize1, 'p2': prize2
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
