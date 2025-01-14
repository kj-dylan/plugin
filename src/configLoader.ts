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

export class ConfigLoader {
    static loadConfig(workspaceRoot: string): ReportConfig {
        console.log('开始加载配置...');
        console.log('工作区路径:', workspaceRoot);

        const configPaths = [
            path.join(workspaceRoot, 'report_config.json'),
            path.join(process.cwd(), 'report_config.json'),
            path.join(__dirname, '../report_config.json')
        ];

        for (const configPath of configPaths) {
            console.log('尝试加载配置文件:', configPath);
            if (fs.existsSync(configPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    console.log('成功加载配置文件:', configPath);
                    return this.normalizeConfig(config);
                } catch (error) {
                    console.warn(`解析配置文件 ${configPath} 失败:`, error);
                }
            }
        }

        console.log('使用默认配置');
        return this.getDefaultConfig();
    }

    static normalizeConfig(config: any): ReportConfig {
        return {
            authorEmail: config.author_email || config.authorEmail || '',
            openaiApiKey: config.openai_api_key || config.openaiApiKey || '',
            ignorePatterns: config.ignore_patterns || config.ignorePatterns || [
                '^Merge',
                '^Revert',
                '^feat\\(deps\\)',
                '^chore\\(deps\\)'
            ],
            categories: config.categories || {
                "功能开发": ["feat", "feature", "新增", "添加"],
                "Bug修复": ["fix", "修复", "bugfix"],
                "优化改进": ["optimize", "优化", "改进", "refactor", "perf"],
                "文档": ["docs", "文档"],
                "测试": ["test", "测试"],
                "构建": ["build", "构建"],
                "其他": []
            },
            promptTemplate: config.prompt_template || config.promptTemplate
        };
    }

    static getDefaultConfig(): ReportConfig {
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
} 