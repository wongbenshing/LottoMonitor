import csv

def read_csv(file_path):
    """读取CSV文件，返回数据列表"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({
                'id': row['id'],
                'date': row['date'],
                'front': [int(row[f'f{i}']) for i in range(1, 6)],
                'back': [int(row[f'b{i}']) for i in range(1, 3)]
            })
    return data

def create_sum_intervals():
    """创建和值区间"""
    intervals = []
    
    intervals.append({
        'index': 0,
        'min': 15,
        'max': 34,
        'label': '15-34'
    })
    
    start = 35
    step = 8
    mid_end = 146
    index = 1
    
    while start <= mid_end:
        max_val = start + step - 1
        intervals.append({
            'index': index,
            'min': start,
            'max': max_val,
            'label': f"{start}-{max_val}"
        })
        start += step
        index += 1
    
    intervals.append({
        'index': index,
        'min': 147,
        'max': 165,
        'label': '147-165'
    })
    
    return intervals

def get_sum_interval_index(sum_val, intervals):
    """获取和值所在的区间索引"""
    for interval in intervals:
        if interval['min'] <= sum_val <= interval['max']:
            return interval['index']
    return -1

def build_transition_matrices(history, intervals, order=3):
    """构建概率转移矩阵"""
    num_intervals = len(intervals)
    
    # 计算每个开奖的和值区间
    sum_indices = []
    for draw in history:
        sum_val = sum(draw['front'])
        idx = get_sum_interval_index(sum_val, intervals)
        if idx != -1:
            sum_indices.append(idx)
    
    # 构建1阶转移矩阵
    first_order = [[0] * num_intervals for _ in range(num_intervals)]
    for i in range(len(sum_indices) - 1):
        current = sum_indices[i]
        next_idx = sum_indices[i + 1]
        first_order[current][next_idx] += 1
    
    # 归一化
    for i in range(num_intervals):
        row_sum = sum(first_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                first_order[i][j] /= row_sum
    
    # 构建2阶转移矩阵
    second_order = [[0] * num_intervals for _ in range(num_intervals * num_intervals)]
    for i in range(len(sum_indices) - 2):
        current = sum_indices[i]
        prev = sum_indices[i + 1]
        next_idx = sum_indices[i + 2]
        key = current * num_intervals + prev
        second_order[key][next_idx] += 1
    
    # 归一化
    for i in range(len(second_order)):
        row_sum = sum(second_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                second_order[i][j] /= row_sum
    
    # 构建3阶转移矩阵
    third_order = [[0] * num_intervals for _ in range(num_intervals ** 3)]
    for i in range(len(sum_indices) - 3):
        current = sum_indices[i]
        prev1 = sum_indices[i + 1]
        prev2 = sum_indices[i + 2]
        next_idx = sum_indices[i + 3]
        key = current * num_intervals * num_intervals + prev1 * num_intervals + prev2
        third_order[key][next_idx] += 1
    
    # 归一化
    for i in range(len(third_order)):
        row_sum = sum(third_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                third_order[i][j] /= row_sum
    
    return {
        'intervals': intervals,
        'first_order': first_order,
        'second_order': second_order,
        'third_order': third_order,
        'sum_indices': sum_indices
    }

def predict_next_interval(matrices, recent_indices, intervals):
    """预测下一期和值区间（使用加权平均）"""
    num_intervals = len(intervals)
    
    # 计算各阶概率
    first_probs = [1/num_intervals] * num_intervals
    second_probs = [1/num_intervals] * num_intervals
    third_probs = [1/num_intervals] * num_intervals
    
    if len(recent_indices) >= 1:
        current_idx = recent_indices[0]
        first_probs = matrices['first_order'][current_idx].copy()
    
    if len(recent_indices) >= 2:
        current_idx = recent_indices[0]
        prev_idx = recent_indices[1]
        key = current_idx * num_intervals + prev_idx
        if key < len(matrices['second_order']):
            second_probs = matrices['second_order'][key].copy()
    
    if len(recent_indices) >= 3:
        current_idx = recent_indices[0]
        prev_idx1 = recent_indices[1]
        prev_idx2 = recent_indices[2]
        key = current_idx * num_intervals * num_intervals + prev_idx1 * num_intervals + prev_idx2
        if key < len(matrices['third_order']):
            third_probs = matrices['third_order'][key].copy()
    
    # 加权平均：1阶80%，2阶16%，3阶4%
    max_score = -1
    best_idx = 0
    for i in range(num_intervals):
        score = first_probs[i] * 0.8 + second_probs[i] * 0.16 + third_probs[i] * 0.04
        if score > max_score:
            max_score = score
            best_idx = i
    
    # 返回预测结果和各阶概率（预测区间的概率）
    return {
        'predicted_idx': best_idx,
        'score': max_score,
        'first_prob': first_probs[best_idx],
        'second_prob': second_probs[best_idx],
        'third_prob': third_probs[best_idx]
    }

def calculate_success_rate(data, test_count=100):
    """计算预测成功率"""
    intervals = create_sum_intervals()
    
    # 计算所有和值区间
    all_sum_indices = []
    for draw in data:
        sum_val = sum(draw['front'])
        idx = get_sum_interval_index(sum_val, intervals)
        all_sum_indices.append(idx)
    
    correct_count = 0
    total_count = 0
    results = []
    
    # CSV数据是倒序排列的：data[0]是最新期，data[-1]是最老期
    # 测试逻辑：用最近100期数据训练，预测更老的一期（模拟历史预测）
    # 例如：用data[1:101]训练，预测data[0]；用data[2:102]训练，预测data[1]
    
    for i in range(len(data) - 100):
        if total_count >= test_count:
            break
        
        # 使用最近100期数据训练（data[i+1:i+101]）
        train_data = data[i+1:i+101]
        matrices = build_transition_matrices(train_data, intervals)
        
        # 获取训练数据最后3期的区间索引（用于预测）
        recent_indices = all_sum_indices[i+1:i+4]
        
        # 预测data[i]（比训练数据更新的一期）
        pred_result = predict_next_interval(matrices, recent_indices, intervals)
        predicted_idx = pred_result['predicted_idx']
        score = pred_result['score']
        first_prob = pred_result['first_prob']
        second_prob = pred_result['second_prob']
        third_prob = pred_result['third_prob']
        
        # 实际结果（data[i]）
        actual_idx = all_sum_indices[i]
        
        # 记录结果
        is_correct = predicted_idx == actual_idx
        if is_correct:
            correct_count += 1
        total_count += 1
        
        results.append({
            'period': data[i]['id'],
            'date': data[i]['date'],
            'actual_sum': sum(data[i]['front']),
            'actual_interval': intervals[actual_idx]['label'],
            'predicted_interval': intervals[predicted_idx]['label'],
            'is_correct': is_correct,
            'confidence': score,
            'first_prob': first_prob,
            'second_prob': second_prob,
            'third_prob': third_prob
        })
    
    success_rate = correct_count / total_count if total_count > 0 else 0
    
    return {
        'success_rate': success_rate,
        'correct_count': correct_count,
        'total_count': total_count,
        'results': results
    }

def predict_next_interval_with_weights(matrices, recent_indices, intervals, weights):
    """使用指定权重预测下一期和值区间"""
    num_intervals = len(intervals)
    
    first_probs = [1/num_intervals] * num_intervals
    second_probs = [1/num_intervals] * num_intervals
    third_probs = [1/num_intervals] * num_intervals
    
    if len(recent_indices) >= 1:
        current_idx = recent_indices[0]
        first_probs = matrices['first_order'][current_idx].copy()
    
    if len(recent_indices) >= 2:
        current_idx = recent_indices[0]
        prev_idx = recent_indices[1]
        key = current_idx * num_intervals + prev_idx
        if key < len(matrices['second_order']):
            second_probs = matrices['second_order'][key].copy()
    
    if len(recent_indices) >= 3:
        current_idx = recent_indices[0]
        prev_idx1 = recent_indices[1]
        prev_idx2 = recent_indices[2]
        key = current_idx * num_intervals * num_intervals + prev_idx1 * num_intervals + prev_idx2
        if key < len(matrices['third_order']):
            third_probs = matrices['third_order'][key].copy()
    
    w1, w2, w3 = weights
    max_score = -1
    best_idx = 0
    for i in range(num_intervals):
        score = first_probs[i] * w1 + second_probs[i] * w2 + third_probs[i] * w3
        if score > max_score:
            max_score = score
            best_idx = i
    
    return best_idx

def calculate_success_rate_with_weights(data, test_count=100, weights=(0.8, 0.16, 0.04), train_periods=100):
    """使用指定权重计算预测成功率"""
    intervals = create_sum_intervals()
    
    all_sum_indices = []
    for draw in data:
        sum_val = sum(draw['front'])
        idx = get_sum_interval_index(sum_val, intervals)
        all_sum_indices.append(idx)
    
    correct_count = 0
    total_count = 0
    
    for i in range(len(data) - train_periods):
        if total_count >= test_count:
            break
        
        train_data = data[i+1:i+train_periods+1]
        matrices = build_transition_matrices(train_data, intervals)
        recent_indices = all_sum_indices[i+1:i+4]
        
        predicted_idx = predict_next_interval_with_weights(matrices, recent_indices, intervals, weights)
        actual_idx = all_sum_indices[i]
        
        if predicted_idx == actual_idx:
            correct_count += 1
        total_count += 1
    
    return correct_count / total_count if total_count > 0 else 0

def main():
    # 读取数据
    data = read_csv('history.csv')
    print(f"读取到 {len(data)} 期数据")
    
    # 测试不同训练期数
    for train_periods in [100, 200]:
        print(f"\n{'='*60}")
        print(f"训练期数: {train_periods} 期")
        print(f"{'='*60}")
        
        print(f"\n=== 权重组合测试（步长0.05）===")
        print(f"{'1阶权重':<12} {'2阶权重':<12} {'3阶权重':<12} {'成功率':<10}")
        print("-" * 50)
        
        best_weights = None
        best_rate = 0
        results = []
        
        step = 0.05
        for w1 in [round(i * step, 2) for i in range(int(1/step) + 1)]:
            for w2 in [round(i * step, 2) for i in range(int((1 - w1)/step) + 1)]:
                w3 = round(1 - w1 - w2, 2)
                if w3 < 0:
                    continue
                
                rate = calculate_success_rate_with_weights(data, test_count=100, weights=(w1, w2, w3), train_periods=train_periods)
                results.append((w1, w2, w3, rate))
                
                if rate > best_rate:
                    best_rate = rate
                    best_weights = (w1, w2, w3)
        
        # 按成功率排序输出前20个
        results.sort(key=lambda x: -x[3])
        
        for w1, w2, w3, rate in results[:10]:
            print(f"{w1:<12} {w2:<12} {w3:<12} {rate*100:<10.2f}%")
        
        print(f"\n最佳权重组合: 1阶={best_weights[0]}, 2阶={best_weights[1]}, 3阶={best_weights[2]}")
        print(f"最佳成功率: {best_rate * 100:.2f}%")
        
        # 统计各权重区间的平均成功率
        print("\n=== 各1阶权重平均成功率 ===")
        for w1 in [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
            filtered = [r for r in results if abs(r[0] - w1) < 0.001]
            if filtered:
                avg_rate = sum(r[3] for r in filtered) / len(filtered)
                print(f"1阶权重={w1}: 平均成功率={avg_rate*100:.2f}%")

if __name__ == '__main__':
    main()