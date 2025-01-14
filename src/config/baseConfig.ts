import * as fs from 'fs';
import * as path from 'path';

export interface ReportConfig {
    authorEmail: string;
    openaiApiKey: string;
    ignorePatterns: string[];
    categories: {
        [key: string]: string[];
    };
    promptTemplate?: string;
}

export class BaseConfigManager {
    protected static getDefaultConfig(): ReportConfig {
        return {
            authorEmail: process.env.GIT_AUTHOR_EMAIL || '',
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            ignorePatterns: [
                '^Merge',
                '^Revert',
                '^feat\\(deps\\)',
                '^chore\\(deps\\)'
            ],
            categories: {
                "功能开发": ["feat", "feature", "新增", "添加"],
                "Bug修复": ["fix", "修复", "bugfix"],
                "优化改进": ["optimize", "优化", "改进", "refactor", "perf"],
                "文档": ["docs", "文档"],
                "测试": ["test", "测试"],
                "构建": ["build", "构建"],
                "其他": []
            }
        };
    }

    protected static normalizeConfig(config: any): ReportConfig {
        return {
            authorEmail: config.author_email || config.authorEmail || '',
            openaiApiKey: config.openai_api_key || config.openaiApiKey || '',
            ignorePatterns: config.ignore_patterns || config.ignorePatterns || this.getDefaultConfig().ignorePatterns,
            categories: config.categories || this.getDefaultConfig().categories,
            promptTemplate: config.prompt_template || config.promptTemplate
        };
    }

    protected static loadConfigFromFile(configPath: string): ReportConfig | null {
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return this.normalizeConfig(config);
            }
        } catch (error) {
            console.warn(`加载配置文件失败 ${configPath}:`, error);
        }
        return null;
    }
} 