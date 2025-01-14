import * as vscode from 'vscode';
import { OpenAIService } from './openaiService';
import { ReportConfig, GitCommit } from './config';
import { GitService } from './gitService';
import { getVSCodeLanguage } from './utils/language';
import * as fs from 'fs';
import * as path from 'path';
import { switchReadmeLanguage } from './utils/language';

async function scanGitRepositories(basePath: string): Promise<Array<{ path: string; name: string }>> {
    const repos: Array<{ path: string; name: string }> = [];

    try {
        // 检查基础路径本身是否是 Git 仓库
        if (fs.existsSync(path.join(basePath, '.git'))) {
            repos.push({
                path: basePath,
                name: path.basename(basePath)
            });
        }

        // 扫描第一层子文件夹
        const entries = fs.readdirSync(basePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = path.join(basePath, entry.name);
                if (fs.existsSync(path.join(subPath, '.git'))) {
                    repos.push({
                        path: subPath,
                        name: entry.name
                    });
                }
            }
        }
    } catch (error) {
        console.error('扫描仓库失败:', error);
    }

    return repos;
}

// 添加日期范围计算函数
function calculateDateRange(reportType: string): { from: string; to: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (reportType.toLowerCase()) {
        case 'daily':
            // 获取当天 00:00 到明天 00:00
            return {
                from: today.toISOString().split('T')[0],
                to: tomorrow.toISOString().split('T')[0]
            };

        case 'weekly':
            // 获取本周一 00:00 到现在
            const monday = new Date(today);
            monday.setDate(today.getDate() - (today.getDay() || 7) + 1);
            return {
                from: monday.toISOString().split('T')[0],
                to: tomorrow.toISOString().split('T')[0]
            };

        case 'monthly':
            // 获取本月 1 号 00:00 到现在
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            return {
                from: firstDay.toISOString().split('T')[0],
                to: tomorrow.toISOString().split('T')[0]
            };

        case 'quarterly':
            // 获取本季度第一天 00:00 到现在
            const quarterFirstMonth = Math.floor(today.getMonth() / 3) * 3;
            const quarterFirstDay = new Date(today.getFullYear(), quarterFirstMonth, 1);
            return {
                from: quarterFirstDay.toISOString().split('T')[0],
                to: tomorrow.toISOString().split('T')[0]
            };

        default:
            return {
                from: today.toISOString().split('T')[0],
                to: tomorrow.toISOString().split('T')[0]
            };
    }
}

// 修改文件名生成逻辑
function getReportFileName(reportType: string): string {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 确保使用正确的报告类型
    const reportTypeMap: { [key: string]: string } = {
        'daily': '日报',
        'weekly': '周报',
        'monthly': '月报',
        'quarterly': '季报'
    };

    const reportName = reportTypeMap[reportType.toLowerCase()] || '报告';
    return `${reportName}-${dateStr}.md`;
}

async function generateReport(config: vscode.WorkspaceConfiguration, channel: vscode.OutputChannel, reportType?: string) {
    const currentReportType = reportType || config.get<string>('reportType') || 'weekly';
    const isZh = getVSCodeLanguage().startsWith('zh');

    const reportTypeMap: { [key: string]: string } = {
        'daily': '日报',
        'weekly': '周报',
        'monthly': '月报',
        'quarterly': '季报'
    };

    const reportName = reportTypeMap[currentReportType.toLowerCase()] || '报告';

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: isZh ? `正在生成${reportName}...` : `Generating ${currentReportType} report...`,
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0 });

            channel.appendLine(`开始生成${config.get('reportType')}报告...`);
            channel.appendLine(`当前语言: ${getVSCodeLanguage()}`);

            const apiKey = config.get<string>('openai.apiKey');

            // 创建 OpenAI 服务实例
            const openaiService = new OpenAIService(apiKey!, {
                authorEmail: config.get('authorEmail', ''),
                openaiApiKey: apiKey!,
                baseUrl: config.get('openai.baseUrl'),
                promptTemplate: config.get('promptTemplate'),
                ignorePatterns: config.get('ignorePatterns', [
                    '^Merge',
                    '^Revert',
                    '^feat\\(deps\\)',
                    '^chore\\(deps\\)'
                ]),
                categories: config.get('categories', {
                    "功能开发": ["feat", "feature"],
                    "Bug修复": ["fix", "bugfix"],
                    "其他": []
                })
            });

            // 获取工作区路径
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('没有打开的工作区');
            }

            // 设置默认的保存路径
            const reportsFolderPath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'reports');

            // 确保 reports 文件夹存在
            try {
                await vscode.workspace.fs.createDirectory(reportsFolderPath);
            } catch (error) {
                channel.appendLine(`创建reports文件夹失败: ${error}`);
            }

            channel.appendLine(`报告类型: ${currentReportType}`);

            // 获取自定义日期范围
            const customRange = config.get<any>('customRange');
            let dateRange: { from: string; to: string };

            if (customRange && customRange.from && customRange.to) {
                dateRange = customRange;
                channel.appendLine('使用自定义日期范围');
            } else {
                dateRange = calculateDateRange(currentReportType);
                channel.appendLine('使用自动计算的日期范围');
            }

            channel.appendLine(`日期范围: ${dateRange.from} 到 ${dateRange.to}`);

            // 使用新的文件名生成函数
            const fileName = getReportFileName(currentReportType);
            const fileUri = vscode.Uri.joinPath(reportsFolderPath, fileName);

            // 获取配置的仓库路径并扫描子文件夹
            const configuredRepos = config.get<any[]>('repositories') || [];
            const allRepos: Array<{ path: string; name: string }> = [];

            for (const repo of configuredRepos) {
                const subRepos = await scanGitRepositories(repo.path);
                allRepos.push(...subRepos);
            }

            channel.appendLine(`找到的仓库数量: ${allRepos.length}`);

            // 创建 Git 服务
            const gitService = new GitService(channel);

            // 获取所有仓库的提交记录
            const allCommits: GitCommit[] = [];
            for (const repo of allRepos) {
                channel.appendLine(`处理仓库: ${repo.name} (${repo.path})`);
                try {
                    const result = await gitService.getCommits(
                        repo.path,
                        repo.name,
                        dateRange.from,
                        dateRange.to
                    );
                    allCommits.push(...result.commits);
                } catch (error) {
                    channel.appendLine(`处理仓库 ${repo.name} 失败: ${error}`);
                }
            }

            // 计算所有仓库的总体统计
            const totalStats = {
                totalCommits: allCommits.length,
                totalFiles: allCommits.reduce((sum, commit) => sum + commit.files.length, 0),
                totalAdditions: allCommits.reduce((sum, commit) => sum + commit.stats.additions, 0),
                totalDeletions: allCommits.reduce((sum, commit) => sum + commit.stats.deletions, 0),
                contributors: [...new Set(allCommits.map(c => c.author))],
                mostChangedFiles: gitService.getMostChangedFiles(allCommits)
            };

            channel.appendLine(`总共获取到 ${allCommits.length} 条提交记录`);

            // 生成周报内容
            progress.report({ increment: 70, message: isZh ? '生成报告内容...' : 'Generating report content...' });
            const content = await openaiService.generateSummary({
                commits: allCommits,
                repoStats: totalStats
            }, currentReportType);
            channel.appendLine(`生成的内容长度: ${content.length} 字符`);

            // 保存文件
            progress.report({ increment: 90, message: isZh ? '保存报告...' : 'Saving report...' });
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

            // 打开生成的文件
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);

            channel.appendLine(`${reportName}已生成: ${fileUri.fsPath}`);
            vscode.window.showInformationMessage(`${reportName}已生成: ${fileName}`);

            progress.report({ increment: 100 });

            return content;
        } catch (error) {
            channel.appendLine(`报告生成失败: ${error}`);
            throw error;
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    const channel = vscode.window.createOutputChannel('Weekly Report');

    // 设置默认配置
    const config = vscode.workspace.getConfiguration('weeklyReport');
    if (!config.has('reportType')) {
        config.update('reportType', 'weekly', vscode.ConfigurationTarget.Global);
    }

    // 添加调试日志
    channel.appendLine(`当前语言: ${getVSCodeLanguage()}`);
    channel.appendLine(`报告类型: ${config.get('reportType')}`);

    try {
        // 注册各种报告生成命令
        const reportTypes = [
            { type: 'daily', label: '日报' },
            { type: 'weekly', label: '周报' },
            { type: 'monthly', label: '月报' },
            { type: 'quarterly', label: '季报' }
        ];

        reportTypes.forEach(({ type, label }) => {
            const disposable = vscode.commands.registerCommand(`weeklyReport.generate${type.charAt(0).toUpperCase() + type.slice(1)}`, async () => {
                try {
                    const config = vscode.workspace.getConfiguration('weeklyReport');
                    await config.update('reportType', type, vscode.ConfigurationTarget.Global);
                    await generateReport(config, channel, type);
                } catch (error) {
                    const isZh = getVSCodeLanguage().startsWith('zh');
                    const errorMessage = isZh ?
                        `生成${label}失败: ${error instanceof Error ? error.message : '未知错误'}` :
                        `Failed to generate ${type} report: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    channel.appendLine(`Error: ${errorMessage}`);
                    vscode.window.showErrorMessage(errorMessage);
                }
            });
            context.subscriptions.push(disposable);
        });

        // 修改基础生成命令为生成周报
        const generateDisposable = vscode.commands.registerCommand('weeklyReport.generate', async () => {
            const config = vscode.workspace.getConfiguration('weeklyReport');
            // 默认生成周报
            await generateReport(config, channel, 'weekly');
        });

        // 修改快速选择命令处理
        const quickPickDisposable = vscode.commands.registerCommand('weeklyReport.showQuickPick', async () => {
            const isZh = getVSCodeLanguage().startsWith('zh');
            const items = [
                {
                    label: '$(calendar-day) ' + (isZh ? '生成日报' : 'Generate Daily Report'),
                    reportType: 'daily'
                },
                {
                    label: '$(calendar-week) ' + (isZh ? '生成周报' : 'Generate Weekly Report'),
                    reportType: 'weekly'
                },
                {
                    label: '$(calendar-month) ' + (isZh ? '生成月报' : 'Generate Monthly Report'),
                    reportType: 'monthly'
                },
                {
                    label: '$(calendar-range) ' + (isZh ? '生成季报' : 'Generate Quarterly Report'),
                    reportType: 'quarterly'
                }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: isZh ? '选择报告类型' : 'Select report type'
            });

            if (selected) {
                try {
                    const config = vscode.workspace.getConfiguration('weeklyReport');
                    // 更新配置中的报告类型
                    await config.update('reportType', selected.reportType, vscode.ConfigurationTarget.Global);
                    // 直接生成对应类型的报告
                    await generateReport(config, channel, selected.reportType);
                } catch (error) {
                    vscode.window.showErrorMessage(isZh ?
                        `生成${selected.label}失败: ${error}` :
                        `Failed to generate ${selected.label}: ${error}`
                    );
                }
            }
        });

        // 修改语言切换命令
        const switchLanguageDisposable = vscode.commands.registerCommand('weeklyReport.switchLanguage', async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return;
            }

            const currentLanguage = getVSCodeLanguage();
            const targetFileName = currentLanguage === 'zh' ? 'README_zh.md' : 'README.md';
            const readmePath = vscode.Uri.joinPath(workspaceFolders[0].uri, targetFileName);

            try {
                const doc = await vscode.workspace.openTextDocument(readmePath);
                await vscode.window.showTextDocument(doc, {
                    preview: false,
                    preserveFocus: false
                });
            } catch (error) {
                vscode.window.showErrorMessage(`无法找到${targetFileName}文件`);
            }
        });

        // 添加自动语言检测和文档切换
        const autoLanguageDisposable = vscode.workspace.onDidOpenTextDocument(async (document) => {
            if (document.fileName.endsWith('README.md') || document.fileName.endsWith('README_zh.md')) {
                const currentLanguage = getVSCodeLanguage();
                console.log('Auto language detection triggered:', {
                    currentFile: document.fileName,
                    detectedLanguage: currentLanguage
                });

                // 强制切换到正确的语言版本
                await switchReadmeLanguage(currentLanguage);
            }
        });

        // 在工作区打开时也检查一次
        if (vscode.window.activeTextEditor?.document.fileName.includes('README')) {
            switchReadmeLanguage();
        }

        context.subscriptions.push(autoLanguageDisposable);

        context.subscriptions.push(
            quickPickDisposable,
            switchLanguageDisposable,
            generateDisposable
        );

        // 在插件激活时立即检查并切换语言
        setTimeout(async () => {
            try {
                console.log('Plugin activated, checking README language...');
                await switchReadmeLanguage();
            } catch (error) {
                console.error('Failed to switch README language on activation:', error);
            }
        }, 1000); // 延迟1秒执行，确保工作区已完全加载

    } catch (error) {
        channel.appendLine(`插件激活失败: ${error}`);
        throw error;
    }
}

export function deactivate() {
    const channel = vscode.window.createOutputChannel('Weekly Report');
    channel.appendLine('插件已停用');
} 