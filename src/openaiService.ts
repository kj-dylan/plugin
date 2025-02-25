import OpenAI from 'openai';
import { ReportConfig, GitCommit, RepoStats } from './config';
import { workspace } from 'vscode';

export class OpenAIService {
    private client: InstanceType<typeof OpenAI>;
    private config: ReportConfig;
    private model: string;

    constructor(apiKey: string, config: ReportConfig) {
        console.log('初始化 OpenAI 服务...');
        console.log('API Base URL:', 'https://api.deepseek.com');

        this.client = new OpenAI({
            apiKey,
            baseURL: 'https://api.deepseek.com'
        });
        this.config = config;
        this.model = workspace.getConfiguration('weeklyReport.openai').get('model', 'deepseek-chat');
    }

    private getReportTitle(reportType: string): string {
        switch (reportType) {
            case 'daily':
                return '今日工作报告';
            case 'weekly':
                return '本周工作报告';
            case 'monthly':
                return '本月工作报告';
            case 'quarterly':
                return '本季度工作报告';
            default:
                return '工作报告';
        }
    }

    async generateSummary(data: { commits: GitCommit[]; repoStats: RepoStats }, reportType: string = 'weekly'): Promise<string> {
        try {
            const aiSummary = await this.generateAISummary(data);
            const statsSection = this.generateStatsSection(data.repoStats);
            const title = this.getReportTitle(reportType);

            const fullReport = `
# ${title}

${aiSummary}

${statsSection}`;

            return fullReport;
        } catch (error) {
            console.error('生成周报失败:', error);
            throw error;
        }
    }

    private generateStatsSection(repoStats: RepoStats): string {
        return `
## 统计信息

### 提交统计
- 总提交次数：${repoStats.totalCommits} 次
- 总文件变更：${repoStats.totalFiles} 个文件
- 代码变更：新增 ${repoStats.totalAdditions} 行，删除 ${repoStats.totalDeletions} 行
- 净变更：${repoStats.totalAdditions - repoStats.totalDeletions} 行
- 参与贡献者：${repoStats.contributors.join(', ')}

### 变更最多的文件 (Top 5)
${repoStats.mostChangedFiles.map((f, index) =>
            `${index + 1}. ${f.file}
    - 变更行数：${f.changes} 行`
        ).join('\n')}`;
    }

    private generateCommitsSection(commits: GitCommit[]): string {
        return commits.map(commit => `
### 提交 [${commit.hash.substring(0, 7)}]
- 提交者：${commit.author} (${commit.email})
- 时间：${new Date(commit.date).toLocaleString()}
- 主题：${commit.subject}
${commit.body ? `- 详细说明：${commit.body}` : ''}

#### 文件变更：
${commit.files.map(f =>
            `- ${f.status === 'M' ? '修改' : f.status === 'A' ? '新增' : f.status === 'D' ? '删除' : f.status} \`${f.name}\`
    - 变更：+${f.stats?.additions || 0}/-${f.stats?.deletions || 0}`
        ).join('\n')}`
        ).join('\n\n---\n\n');
    }

    private async generateAISummary(data: { commits: GitCommit[]; repoStats: RepoStats }): Promise<string> {
        const prompt = `请根据以下Git提交记录生成一份工作内容总结，要求：
1. 按照工作类型分类整理（如功能开发、问题修复、优化改进等）
2. 合并相似的工作内容，但保留重要的技术细节
3. 使用简洁的语言描述，每项总结不超过70个字
4. 总结条数限制在5-12条之间
5. 每条总结数字不超过80字
6. 使用markdown格式，不要使用\`\`\`markdown\`\`\`代码块
7. 分类使用四级标题，并给分类标题添加序号，不要给总结内容加序号
8. 尽量理解功能或者业务，使用功能或者业务总结工作内容，尽量避免使用文件名

提交记录：
${data.commits.map(c => `- ${c.subject} [${c.hash.substring(0, 7)}]
  ${c.files.map(f => `  * ${f.status} ${f.name}`).join('\n')}`).join('\n')}

请生成一份结构清晰、重点突出的工作内容总结。`;

        try {
            console.log('使用的模型:', this.model);
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一名专业的技术周报生成助手。请保持简洁和专业性。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return `## 工作总结\n\n${response.choices[0].message.content || '生成失败，请重试。'}`;
        } catch (error) {
            console.error('API 请求失败:', error);

            // 检查 error 是否为 Error 类型
            if (error instanceof Error) {
                console.error('错误信息:', error.message);
                // 如果有 response 属性，尝试访问它
                const apiError = error as { response?: { data?: any } };
                if (apiError.response) {
                    console.error('API 响应:', apiError.response.data);
                }
            } else {
                console.error('未知错误:', error);
            }

            throw new Error('生成工作总结失败，请检查 API 设置和网络连接。');
        }
    }
} 