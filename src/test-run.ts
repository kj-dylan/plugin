import { GitService } from './gitService';
import { MockOutputChannel } from './testUtils';

async function main() {
    const outputChannel = new MockOutputChannel();
    const gitService = new GitService(outputChannel);

    try {
        const result = await gitService.getCommits(
            process.cwd(),
            'test-repo',
            '2024-01-01',
            '2024-12-31'
        );

        console.log('获取到的提交记录:');
        result.commits.forEach(commit => {
            console.log('-------------------');
            console.log('仓库:', commit.repo);
            console.log('消息:', commit.subject);
            console.log('文件:', commit.files.map(f => f.name).join(', '));
            if (commit.stats) {
                console.log('变更:', `+${commit.stats.additions}, -${commit.stats.deletions}`);
            }
            console.log('Hash:', commit.hash);
            console.log('作者:', commit.author);
            console.log('日期:', commit.date);
        });

        console.log('\n统计信息:');
        console.log('总提交数:', result.repoStats.totalCommits);
        console.log('总文件变更:', result.repoStats.totalFiles);
        console.log('代码变更:', `+${result.repoStats.totalAdditions}, -${result.repoStats.totalDeletions}`);

    } catch (error) {
        console.error('测试运行失败:', error);
    }
}

main().catch(console.error); 