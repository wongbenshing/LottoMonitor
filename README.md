# LottoMonitor (大乐透智析)

一个专业的超级大乐透（中国体育彩票）数据分析工具，提供历史开奖查询、走势分析、AI智能选号等功能。

![版本](https://img.shields.io/badge/version-1.1.0-blue)
![React](https://img.shields.io/badge/React-19.2.3-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6)
![License](https://img.shields.io/badge/license-ISC-green)

## 功能特性

### 核心功能
- **历史数据** - 查看2500+期历史开奖记录，支持年份筛选、日期搜索
- **回测验证** - 输入号码组合，验证历史中奖情况
- **走势分析** - 可视化图表展示和值走势、极差走势、位置热号、后区热力图
- **AI选号** - 基于DeepSeek AI模型的智能号码推荐

### 数据分析（P2新增）
- **遗漏值分析** - 统计每个号码的遗漏期数（多久没出），按冷热程度颜色标识
- **连号分析** - 统计二连号、三连号等出现频率及位置分布
- **重号分析** - 分析与上期重复号码的分布规律

### 合规与体验
- **年龄验证** - 18周岁年龄确认弹窗
- **免责声明** - 首次使用强制确认，明确告知彩票随机性
- **AI风险提示** - 选号结果页显示理性购彩提示
- **状态保持** - AI选号结果切换页面不丢失

## 技术栈

- **前端框架**: React 19.2.3 + TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **样式**: Tailwind CSS (CDN)
- **图表**: Recharts 3.6.0
- **AI服务**: DeepSeek API
- **图片导出**: html-to-image

## 项目结构

```
├── App.tsx                  # 主应用组件
├── index.tsx                # React入口
├── index.html               # HTML模板
├── types.ts                 # TypeScript类型定义
├── utils.ts                 # 工具函数（中奖判断、预测算法、统计计算）
├── constants.tsx            # 常量定义（奖项、Mock数据）
├── vite.config.ts           # Vite配置
├── tsconfig.json            # TypeScript配置
├── package.json             # 依赖管理
├── history.csv              # 历史开奖数据（2500+期）
├── lotto_update.py          # Python数据爬虫
├── .env.local               # 环境变量（API密钥）
├── components/
│   ├── HistoryView.tsx      # 历史数据模块
│   ├── AnalyzerView.tsx     # 回测验证模块
│   ├── StatsView.tsx        # 走势分析模块
│   ├── AIView.tsx           # AI选号模块
│   ├── BottomNav.tsx        # 底部导航
│   ├── DisclaimerModal.tsx  # 免责声明弹窗
│   └── AgeVerification.tsx  # 年龄验证弹窗
└── services/
    ├── lottoService.ts      # CSV数据读取
    └── deepseekService.ts   # DeepSeek API集成
```

## 快速开始

### 环境要求
- Node.js 18+
- npm 9+

### 安装依赖
```bash
npm install
```

### 配置环境变量
创建 `.env.local` 文件：
```env
# DeepSeek API密钥（用于AI选号）
VITE_API_KEY=your_deepseek_api_key
API_KEY=your_deepseek_api_key

# Gemini API密钥（可选，备用）
GEMINI_API_KEY=your_gemini_api_key
```

### 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:3000

### 构建生产版本
```bash
npm run build
```

## 功能详解

### 1. 历史数据模块
- 展示2500+期历史开奖记录
- 支持按年份筛选
- 支持按日期/期号搜索
- 云端数据同步（手动触发）
- CSV导出功能

### 2. 回测验证模块
- 输入前区5个号码+后区2个号码
- 自动验证历史中所有中奖情况
- 显示各奖项中奖次数及日期

### 3. 走势分析模块
- **和值走势** - 前区号码之和的变化趋势
- **极差走势** - 前区最大最小值差的变化
- **位置热号** - 按位置统计出现频率最高的号码
- **后区热力图** - 后区两码组合的频率分布
- **遗漏值分析** - 各号码遗漏期数统计（颜色标识冷热）
- **连号/重号分析** - 连号出现率、重号分布统计

时间范围筛选：通过顶部图表的滑块，可自由选择统计的时间范围。

### 4. AI选号模块
- 基于DeepSeek AI模型分析历史数据
- 支持自定义和值、极差、生成组数
- 生成结果包含历史回测数据
- **状态保持** - 切换页面后结果不丢失
- 支持导出分析报告为图片

## 数据更新

### Python爬虫
```bash
# 安装依赖
pip install requests beautifulsoup4 pandas apscheduler

# 单次更新
python lotto_update.py

# 定时任务（每日开奖后自动更新）
# 修改 lotto_update.py 启用 scheduler
```

## 浏览器存储

应用使用 localStorage 存储以下数据：

| Key | 说明 |
|-----|------|
| `dlt_history` | 历史开奖数据缓存 |
| `ageVerified` | 年龄验证状态 |
| `dlt_disclaimer_agreed` | 免责声明确认状态 |

## 更新日志

### v1.1.0 (2026-03-10)
- **新增** 年龄验证弹窗（18周岁确认）
- **新增** 免责声明弹窗（合规加固）
- **新增** AI选号风险提示
- **新增** 遗漏值分析（冷热号统计）
- **新增** 连号/重号分析
- **新增** AI选号结果状态保持（切换页面不丢失）
- **优化** 遗漏值算法性能（提升35倍）

### v1.0.0
- 初始版本发布
- 历史数据查询
- 走势分析图表
- AI智能选号
- 回测验证功能

## 合规声明

本工具仅供娱乐和学习数据分析使用，不构成任何投注建议。彩票开奖是完全随机的独立事件，历史开奖数据不代表未来结果。请理性购彩，量力而行，切勿沉迷。

## License

ISC

## 致谢

- 数据来源：[500彩票网](https://datachart.500.com/dlt/)
- AI服务：[DeepSeek](https://deepseek.com/)
