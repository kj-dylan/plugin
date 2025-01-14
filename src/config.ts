import * as vscode from 'vscode';

// 定义分类的接口
export interface Categories {
    [key: string]: string[];
}

export interface ReportConfig {
    authorEmail: string;
    openaiApiKey: string;
    ignorePatterns: string[];
    categories: Categories;
    promptTemplate?: string;
    baseUrl?: string;
}

export interface FileChange {
    name: string;
    status: string;
    stats?: {
        additions: number;
        deletions: number;
    };
}

export interface GitCommit {
    repo: string;
    hash: string;
    author: string;
    email: string;
    date: string;
    subject: string;
    body?: string;
    files: FileChange[];
    stats: {
        totalFiles: number;
        additions: number;
        deletions: number;
    };
}

export interface RepoStats {
    totalCommits: number;
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    contributors: string[];
    mostChangedFiles: Array<{ file: string; changes: number }>;
}

export class ConfigManager {
    private static readonly CONFIG_KEY = 'gitWeeklyReport';

    static getConfig(): ReportConfig {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);

        // 默认配置
        const defaultCategories: Categories = {
            "功能开发": ["feat", "feature", "新增", "添加"],
            "Bug修复": ["fix", "修复", "bugfix"],
            "优化改进": ["optimize", "优化", "改进", "refactor", "perf"],
            "文档": ["docs", "文档"],
            "测试": ["test", "测试"],
            "构建": ["build", "构建"],
            "其他": []
        };

        const defaultIgnorePatterns = [
            '^Merge',
            '^Revert',
            '^feat\\(deps\\)',
            '^chore\\(deps\\)'
        ];

        return {
            authorEmail: config.get('authorEmail', ''),
            openaiApiKey: config.get('openaiApiKey', ''),
            ignorePatterns: config.get('ignorePatterns', defaultIgnorePatterns),
            categories: config.get('categories', defaultCategories),
            promptTemplate: config.get('promptTemplate', ''),
            baseUrl: config.get('openai.baseUrl', 'https://api.deepseek.com')
        };
    }

    static async updateConfig(key: string, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
} 