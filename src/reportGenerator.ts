import { OpenAIService } from './openaiService';
import { GitCommit, RepoStats } from './config';

export class ReportGenerator {
    constructor(private openaiService: OpenAIService) { }

    async generateReport(commits: GitCommit[]): Promise<string> {
        try {
            // 计算统计信息
            const repoStats: RepoStats = {
                totalCommits: commits.length,
                totalFiles: commits.reduce((sum, commit) => sum + commit.files.length, 0),
                totalAdditions: commits.reduce((sum, commit) => sum + commit.stats.additions, 0),
                totalDeletions: commits.reduce((sum, commit) => sum + commit.stats.deletions, 0),
                contributors: [...new Set(commits.map(c => c.author))],
                mostChangedFiles: this.getMostChangedFiles(commits)
            };

            // 使用新的格式调用 generateSummary
            const summary = await this.openaiService.generateSummary({ commits, repoStats });
            return summary;
        } catch (error) {
            console.error('生成报告失败:', error);
            throw error;
        }
    }

    private getMostChangedFiles(commits: GitCommit[]): Array<{ file: string; changes: number }> {
        const fileChanges = new Map<string, number>();

        commits.forEach(commit => {
            commit.files.forEach(file => {
                const changes = (file.stats?.additions || 0) + (file.stats?.deletions || 0);
                const current = fileChanges.get(file.name) || 0;
                fileChanges.set(file.name, current + changes);
            });
        });

        return Array.from(fileChanges.entries())
            .map(([file, changes]) => ({ file, changes }))
            .sort((a, b) => b.changes - a.changes)
            .slice(0, 5);
    }
} 