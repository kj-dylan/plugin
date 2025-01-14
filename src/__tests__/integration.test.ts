import { GitService } from '../gitService';
import { MockOutputChannel } from '../testUtils';
import { GitCommit } from '../config';

describe('Git Service Integration Tests', () => {
    let gitService: GitService;
    let outputChannel: MockOutputChannel;

    beforeEach(() => {
        outputChannel = new MockOutputChannel();
        gitService = new GitService(outputChannel);
    });

    test('should get commits', async () => {
        const commits = await gitService.getCommits(
            process.cwd(),
            'test-repo',
            '2024-01-01',
            '2024-12-31'
        );
        expect(commits).toBeDefined();
        expect(Array.isArray(commits)).toBe(true);
    });

    test('should handle empty repository', async () => {
        const commits = await gitService.getCommits(
            '/tmp/empty-repo',  // 使用一个不存在的路径
            'empty-repo',
            '2024-01-01',
            '2024-12-31'
        );
        expect(commits).toEqual([]);
    });

    test('should log output', async () => {
        await gitService.getCommits(
            process.cwd(),
            'test-repo',
            '2024-01-01',
            '2024-12-31'
        );
        expect(outputChannel.getContent()).toContain('开始获取仓库');
    });
}); 