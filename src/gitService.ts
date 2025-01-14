import * as vscode from 'vscode';
import { GitCommit, RepoStats } from './config';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitService {
    constructor(private readonly outputChannel: vscode.OutputChannel) { }

    async getCommits(repoPath: string, repoName: string, fromDate: string, toDate: string): Promise<{ commits: GitCommit[]; repoStats: RepoStats }> {
        this.outputChannel.appendLine(`开始获取仓库 ${repoName} 的提交记录...`);
        this.outputChannel.appendLine(`仓库路径: ${repoPath}`);
        this.outputChannel.appendLine(`日期范围: ${fromDate} 到 ${toDate}`);

        try {
            // 首先检查目录是否是 Git 仓库
            const emptyStats: RepoStats = {
                totalCommits: 0,
                totalFiles: 0,
                totalAdditions: 0,
                totalDeletions: 0,
                contributors: [],
                mostChangedFiles: []
            };

            try {
                await execAsync('git rev-parse --git-dir', { cwd: repoPath });
            } catch (error) {
                this.outputChannel.appendLine(`错误: ${repoPath} 不是有效的 Git 仓库`);
                return { commits: [], repoStats: emptyStats };
            }

            // 修改 git log 命令，一次性获取所有需要的信息
            const gitLogCommand = `git log --since="${fromDate}" --until="${toDate}" --no-merges --pretty=format:"COMMIT_START%n%H%n%an%n%ae%n%ad%n%s%n%b%n==END==" --name-status`;
            this.outputChannel.appendLine(`执行命令: ${gitLogCommand}`);

            const { stdout: commitLog } = await execAsync(gitLogCommand, { cwd: repoPath });

            if (!commitLog.trim()) {
                this.outputChannel.appendLine('没有找到任何提交记录');
                return { commits: [], repoStats: emptyStats };
            }

            // 按提交分割日志
            const commitEntries = commitLog.split('COMMIT_START\n').filter(Boolean);
            const commits: GitCommit[] = [];

            for (const entry of commitEntries) {
                try {
                    // 解析提交信息
                    const [hash, author, email, date, subject, ...rest] = entry.split('\n');

                    // 找到提交信息和文件列表的分隔点
                    const endIndex = rest.indexOf('==END==');
                    const body = rest.slice(0, endIndex).join('\n').trim();
                    const fileChanges = rest.slice(endIndex + 1).filter(Boolean);

                    // 获取文件统计信息
                    const { stdout: numstatOutput } = await execAsync(
                        `git show --numstat --format="" "${hash}"`,
                        { cwd: repoPath }
                    );

                    // 解析文件统计
                    const fileStats = new Map(
                        numstatOutput.trim().split('\n')
                            .filter(Boolean)
                            .map(line => {
                                const [additions, deletions, file] = line.split('\t');
                                return [file, {
                                    additions: parseInt(additions) || 0,
                                    deletions: parseInt(deletions) || 0
                                }];
                            })
                    );

                    // 处理文件变更
                    const files = fileChanges.map(change => {
                        const [status, ...pathParts] = change.split('\t');
                        const name = pathParts.join('\t');
                        const stats = fileStats.get(name);
                        return {
                            name,
                            status,
                            stats: stats || { additions: 0, deletions: 0 }
                        };
                    });

                    // 计算总体统计
                    const totalStats = Array.from(fileStats.values()).reduce(
                        (acc, curr) => ({
                            additions: acc.additions + curr.additions,
                            deletions: acc.deletions + curr.deletions
                        }),
                        { additions: 0, deletions: 0 }
                    );

                    commits.push({
                        repo: repoName,
                        hash,
                        author,
                        email,
                        date,
                        subject,
                        body,
                        files,
                        stats: {
                            totalFiles: files.length,
                            ...totalStats
                        }
                    });

                    this.outputChannel.appendLine(`处理提交 ${hash.substring(0, 7)} 成功`);
                } catch (error) {
                    this.outputChannel.appendLine(`处理提交解析失败: ${error}`);
                    continue;
                }
            }

            // 添加仓库总体统计
            const repoStats = {
                totalCommits: commits.length,
                totalFiles: commits.reduce((sum, commit) => sum + commit.files.length, 0),
                totalAdditions: commits.reduce((sum, commit) => sum + commit.stats.additions, 0),
                totalDeletions: commits.reduce((sum, commit) => sum + commit.stats.deletions, 0),
                contributors: [...new Set(commits.map(c => c.author))],
                mostChangedFiles: this.getMostChangedFiles(commits)
            };

            this.outputChannel.appendLine(`解析完成，统计信息：
            提交数：${repoStats.totalCommits}
            文件变更：${repoStats.totalFiles}
            总增加行数：${repoStats.totalAdditions}
            总删除行数：${repoStats.totalDeletions}
            贡献者：${repoStats.contributors.join(', ')}
            `);

            return { commits, repoStats };
        } catch (error) {
            this.outputChannel.appendLine(`获取提交记录失败: ${error}`);
            throw error;
        }
    }

    public getMostChangedFiles(commits: GitCommit[]): Array<{ file: string; changes: number }> {
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