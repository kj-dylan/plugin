import * as vscode from 'vscode';
import { BaseConfigManager, ReportConfig } from './baseConfig';

export class VSCodeConfigManager extends BaseConfigManager {
    private static readonly CONFIG_KEY = 'gitWeeklyReport';

    static getConfig(): ReportConfig {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
        return {
            authorEmail: config.get('authorEmail', ''),
            openaiApiKey: config.get('openaiApiKey', ''),
            ignorePatterns: config.get('ignorePatterns', this.getDefaultConfig().ignorePatterns),
            categories: config.get('categories', this.getDefaultConfig().categories),
            promptTemplate: config.get('promptTemplate', '')
        };
    }

    static async updateConfig(key: string, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_KEY);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }
} 