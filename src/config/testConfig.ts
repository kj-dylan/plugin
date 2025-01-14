import * as path from 'path';
import { BaseConfigManager, ReportConfig } from './baseConfig';

export class TestConfigManager extends BaseConfigManager {
    static getConfig(workspaceRoot: string): ReportConfig {
        console.log('开始加载测试环境配置...');
        console.log('工作区路径:', workspaceRoot);

        const configPaths = [
            path.join(workspaceRoot, 'report_config.json'),
            path.join(process.cwd(), 'report_config.json'),
            path.join(__dirname, '../../report_config.json')
        ];

        for (const configPath of configPaths) {
            console.log('尝试加载配置文件:', configPath);
            const config = this.loadConfigFromFile(configPath);
            if (config) {
                console.log('成功加载配置文件:', configPath);
                return config;
            }
        }

        console.log('使用默认配置');
        return this.getDefaultConfig();
    }
} 