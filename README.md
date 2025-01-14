# Git 工作报告生成器

[English](./README_en.md) | 简体中文

一个基于 Git 提交记录自动生成工作报告的 VSCode 插件，支持生成日报、周报、月报和季报。

## 功能特点

- 支持多种报告类型（日报、周报、月报、季报）
- 自动扫描子文件夹中的 Git 仓库
- 使用 AI 智能生成工作内容摘要
- 自动统计代码变更数据
- 支持自定义日期范围
- 支持自定义提示词模板


## 配置说明

### 必需配置

```json
{
    "weeklyReport.openai.apiKey": "your-api-key",  // OpenAI API 密钥
    "weeklyReport.repositories": [
        {
            "path": "/root/dylan/plugin/",  // Git 仓库路径（会自动扫描子文件夹）
        }
    ]
}
```

### 可选配置

```json
{
    "weeklyReport.reportType": "weekly",  // 报告类型：daily/weekly/monthly/quarterly
    "weeklyReport.openai.baseUrl": "https://api.deepseek.com",  // API 基础 URL
    "weeklyReport.customRange": {  // 自定义日期范围（可选）
        "from": "2024-01-01",
        "to": "2024-01-08"
    },
    "weeklyReport.promptTemplate": "自定义提示词模板",  // 自定义 AI 提示词
    "weeklyReport.outputPath": "reports"  // 报告输出路径
}
```

## 使用方法

1. 配置必要的参数（API Key 和仓库路径），推荐使用 deepseek 的 API Key（免费额度充足，注册即可使用），其他模型待验证
2. 使用快捷键 `Cmd+Shift+G` (Mac) / `Ctrl+Shift+G` (Windows/Linux) 生成报告
3. 或点击活动栏中的报告生成器图标，选择要生成的报告类型

## 报告类型说明

- 日报：当天的工作内容
- 周报：本周一到当前的工作内容（默认）
- 月报：本月初到当前的工作内容
- 季报：本季度初到当前的工作内容

## 输出示例

生成的报告包含以下内容：
1. 工作内容总结（AI 生成）
2. 统计信息
   - 提交次数
   - 文件变更数
   - 代码行数变化
   - 贡献者信息
   - 变更最多的文件

## 常见问题

Q: 无法获取 Git 提交记录？  
A: 检查仓库路径是否正确，确保目录下有 .git 文件夹

Q: 生成的报告内容为空？  
A: 检查日期范围内是否有提交记录，或尝试调整日期范围

Q: API 调用失败？  
A: 检查 API Key 是否正确，以及网络连接是否正常

## 后期计划

- 针对月报和季报，支持按周统计
- 支持更多的 AI 模型
- 支持自定义报告模板
- 欢迎提需求

## 贡献

欢迎提交 Issue 和 Pull Request

## 许可证

MIT 