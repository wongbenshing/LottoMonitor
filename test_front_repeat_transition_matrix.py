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

def get_front_repeat_index(current_front, prev_front):
    """获取前区重号索引（0-4）"""
    repeat = len([n for n in current_front if n in prev_front])
    return min(repeat, 4)

def build_transition_matrices(data):
    """构建概率转移矩阵"""
    num_intervals = 5

    repeat_indices = []
    for i in range(len(data) - 1):
        current_front = data[i]['front']
        prev_front = data[i + 1]['front']
        idx = get_front_repeat_index(current_front, prev_front)
        repeat_indices.append(idx)

    first_order = [[0] * num_intervals for _ in range(num_intervals)]
    for i in range(len(repeat_indices) - 1):
        current = repeat_indices[i]
        next_idx = repeat_indices[i + 1]
        first_order[current][next_idx] += 1

    for i in range(num_intervals):
        row_sum = sum(first_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                first_order[i][j] /= row_sum

    second_order = [[0] * num_intervals for _ in range(num_intervals * num_intervals)]
    for i in range(len(repeat_indices) - 2):
        current = repeat_indices[i]
        prev = repeat_indices[i + 1]
        next_idx = repeat_indices[i + 2]
        key = current * num_intervals + prev
        second_order[key][next_idx] += 1

    for i in range(len(second_order)):
        row_sum = sum(second_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                second_order[i][j] /= row_sum

    third_order = [[0] * num_intervals for _ in range(num_intervals ** 3)]
    for i in range(len(repeat_indices) - 3):
        current = repeat_indices[i]
        prev1 = repeat_indices[i + 1]
        prev2 = repeat_indices[i + 2]
        next_idx = repeat_indices[i + 3]
        key = current * num_intervals * num_intervals + prev1 * num_intervals + prev2
        third_order[key][next_idx] += 1

    for i in range(len(third_order)):
        row_sum = sum(third_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                third_order[i][j] /= row_sum

    fourth_order = [[0] * num_intervals for _ in range(num_intervals ** 4)]
    for i in range(len(repeat_indices) - 4):
        current = repeat_indices[i]
        prev1 = repeat_indices[i + 1]
        prev2 = repeat_indices[i + 2]
        prev3 = repeat_indices[i + 3]
        next_idx = repeat_indices[i + 4]
        key = current * num_intervals ** 3 + prev1 * num_intervals * num_intervals + prev2 * num_intervals + prev3
        fourth_order[key][next_idx] += 1

    for i in range(len(fourth_order)):
        row_sum = sum(fourth_order[i])
        if row_sum > 0:
            for j in range(num_intervals):
                fourth_order[i][j] /= row_sum

    return {
        'first_order': first_order,
        'second_order': second_order,
        'third_order': third_order,
        'fourth_order': fourth_order,
        'repeat_indices': repeat_indices
    }

def predict_next_with_weights(matrices, recent_indices, weights):
    """使用指定权重预测下一期重号索引"""
    num_intervals = 5

    first_probs = [1/num_intervals] * num_intervals
    second_probs = [1/num_intervals] * num_intervals
    third_probs = [1/num_intervals] * num_intervals
    fourth_probs = [1/num_intervals] * num_intervals

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

    if len(recent_indices) >= 4:
        current_idx = recent_indices[0]
        prev_idx1 = recent_indices[1]
        prev_idx2 = recent_indices[2]
        prev_idx3 = recent_indices[3]
        key = current_idx * num_intervals ** 3 + prev_idx1 * num_intervals * num_intervals + prev_idx2 * num_intervals + prev_idx3
        if key < len(matrices['fourth_order']):
            fourth_probs = matrices['fourth_order'][key].copy()

    w1, w2, w3, w4 = weights
    max_score = -1
    best_idx = 0
    for i in range(num_intervals):
        score = first_probs[i] * w1 + second_probs[i] * w2 + third_probs[i] * w3 + fourth_probs[i] * w4
        if score > max_score:
            max_score = score
            best_idx = i

    return best_idx

def precompute_test_windows(data, test_count=200, train_periods=200):
    """预计算所有测试窗口的转移矩阵和实际结果，返回列表供权重遍历复用"""
    num_intervals = 5
    
    all_repeat_indices = []
    for i in range(len(data) - 1):
        current_front = data[i]['front']
        prev_front = data[i + 1]['front']
        idx = get_front_repeat_index(current_front, prev_front)
        all_repeat_indices.append(idx)
    
    test_windows = []
    
    for i in range(len(data) - train_periods - 1):
        if len(test_windows) >= test_count:
            break
        
        train_data = data[i+1:i+train_periods+2]
        matrices = build_transition_matrices(train_data)
        recent_indices = all_repeat_indices[i+1:i+6]
        actual_idx = all_repeat_indices[i]
        
        test_windows.append({
            'matrices': matrices,
            'recent_indices': recent_indices,
            'actual_idx': actual_idx
        })
    
    return test_windows, num_intervals

def calculate_success_rate_with_weights(test_windows, num_intervals, weights):
    """使用预计算的测试窗口和指定权重计算预测成功率"""
    correct_count = 0
    
    for window in test_windows:
        predicted_idx = predict_next_with_weights(
            window['matrices'], 
            window['recent_indices'], 
            weights
        )
        if predicted_idx == window['actual_idx']:
            correct_count += 1
    
    return correct_count / len(test_windows) if len(test_windows) > 0 else 0

def calculate_confusion_matrix(test_windows, num_intervals, weights):
    """使用预计算的测试窗口和指定权重计算混淆矩阵"""
    confusion_matrix = [[0] * num_intervals for _ in range(num_intervals)]
    
    for window in test_windows:
        predicted_idx = predict_next_with_weights(
            window['matrices'], 
            window['recent_indices'], 
            weights
        )
        actual_idx = window['actual_idx']
        confusion_matrix[actual_idx][predicted_idx] += 1
    
    return confusion_matrix

def main():
    data = read_csv('history.csv')
    print(f"读取到 {len(data)} 期数据")

    print(f"\n=== 前区重号索引说明 ===")
    print(f"  0: 0重号")
    print(f"  1: 1重号")
    print(f"  2: 2重号")
    print(f"  3: 3重号")
    print(f"  4: 4重号")

    test_count = 200
    train_periods = len(data) - test_count

    print(f"\n{'='*60}")
    print(f"训练期数: {train_periods} 期")
    print(f"测试期数: {test_count} 期")
    print(f"{'='*60}")

    print(f"\n正在预构建测试窗口的转移矩阵...")
    test_windows, num_intervals = precompute_test_windows(data, test_count=test_count, train_periods=train_periods)
    print(f"已预构建 {len(test_windows)} 个测试窗口")

    print(f"\n=== 权重组合测试（步长0.20）===")
    print(f"{'1阶权重':<10} {'2阶权重':<10} {'3阶权重':<10} {'4阶权重':<10} {'成功率':<10}")
    print("-" * 60)

    best_weights = None
    best_rate = 0
    results = []

    step = 0.20
    
    for w1 in [round(i * step, 2) for i in range(int(1/step) + 1)]:
        for w2 in [round(i * step, 2) for i in range(int((1 - w1)/step) + 1)]:
            for w3 in [round(i * step, 2) for i in range(int((1 - w1 - w2)/step) + 1)]:
                w4 = round(1 - w1 - w2 - w3, 2)
                if w4 < 0:
                    continue
                
                rate = calculate_success_rate_with_weights(test_windows, num_intervals, (w1, w2, w3, w4))
                results.append((w1, w2, w3, w4, rate))
                
                if rate > best_rate:
                    best_rate = rate
                    best_weights = (w1, w2, w3, w4)

    results.sort(key=lambda x: -x[4])

    for w1, w2, w3, w4, rate in results[:20]:
        print(f"{w1:<10.2f} {w2:<10.2f} {w3:<10.2f} {w4:<10.2f} {rate*100:<10.2f}%")

    print(f"\n最佳权重组合: 1阶={best_weights[0]}, 2阶={best_weights[1]}, 3阶={best_weights[2]}, 4阶={best_weights[3]}")
    print(f"最佳成功率: {best_rate * 100:.2f}%")

    print(f"\n{'='*60}")
    print(f"最佳权重下预测结果与实际结果分布矩阵")
    print(f"{'='*60}")
    print(f"行: 实际结果索引 | 列: 预测结果索引")
    print(f"对角线(左上到右下)为预测正确的情况")
    print(f"{'='*60}")

    confusion_matrix = calculate_confusion_matrix(test_windows, num_intervals, best_weights)
    index_labels = ['0重号', '1重号', '2重号', '3重号', '4重号']

    print(f"{'':<10}", end='')
    for label in index_labels:
        print(f"{label:<10}", end='')
    print()

    for i in range(len(confusion_matrix)):
        print(f"{index_labels[i]:<10}", end='')
        for j in range(len(confusion_matrix[i])):
            if i == j:
                print(f"\033[1;32m{confusion_matrix[i][j]:<10}\033[0m", end='')
            else:
                print(f"{confusion_matrix[i][j]:<10}", end='')
        print()

    correct_total = sum(confusion_matrix[i][i] for i in range(len(confusion_matrix)))
    total = sum(sum(row) for row in confusion_matrix)
    print(f"\n预测正确总数: {correct_total}, 总测试数: {total}, 正确率: {correct_total/total*100:.2f}%")

if __name__ == '__main__':
    main()
