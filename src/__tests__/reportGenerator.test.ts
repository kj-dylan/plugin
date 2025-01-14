import { ReportGenerator } from '../reportGenerator';
import { OpenAIService } from '../openaiService';
import { GitCommit, ReportConfig } from '../config';

// 创建 OpenAIService 的 Mock
class MockOpenAIService extends OpenAIService {
    constructor() {
        const mockConfig: ReportConfig = {
            authorEmail: 'test@example.com',
            openaiApiKey: 'mock-key',
            ignorePatterns: [],
            categories: {},
            baseUrl: 'https://api.example.com'
        };
        super('mock-key', mockConfig);
    }

    async generateSummary(): Promise<string> {
        return '模拟的周报内容';
    }
}

describe('ReportGenerator', () => {
    let mockOpenAIService: OpenAIService;

    beforeEach(() => {
        mockOpenAIService = new MockOpenAIService();
    });

    it('should generate report correctly', async () => {
        const generator = new ReportGenerator(mockOpenAIService);

        const mockCommits: GitCommit[] = [{
            repo: 'test-repo',
            hash: '123456',
            author: 'Test User',
            email: 'test@example.com',
            date: '2025-01-08T10:00:00Z',
            subject: 'Test commit',
            body: 'Test commit body',
            files: [{
                name: 'test.ts',
                status: 'M',
                stats: {
                    additions: 10,
                    deletions: 5
                }
            }],
            stats: {
                totalFiles: 1,
                additions: 10,
                deletions: 5
            }
        }];

        const report = await generator.generateReport(mockCommits);
        expect(report).toBe('模拟的周报内容');
    });

    it('should handle empty commits', async () => {
        const generator = new ReportGenerator(mockOpenAIService);
        const report = await generator.generateReport([]);
        expect(report).toBe('模拟的周报内容');
    });

    it('should calculate file changes correctly', async () => {
        const generator = new ReportGenerator(mockOpenAIService);
        const mockCommits: GitCommit[] = [
            {
                repo: 'test-repo',
                hash: '123456',
                author: 'Test User',
                email: 'test@example.com',
                date: '2025-01-08T10:00:00Z',
                subject: 'Test commit 1',
                files: [{
                    name: 'test1.ts',
                    status: 'M',
                    stats: {
                        additions: 10,
                        deletions: 5
                    }
                }],
                stats: {
                    totalFiles: 1,
                    additions: 10,
                    deletions: 5
                }
            },
            {
                repo: 'test-repo',
                hash: '789012',
                author: 'Test User',
                email: 'test@example.com',
                date: '2025-01-08T11:00:00Z',
                subject: 'Test commit 2',
                files: [{
                    name: 'test1.ts',
                    status: 'M',
                    stats: {
                        additions: 15,
                        deletions: 8
                    }
                }],
                stats: {
                    totalFiles: 1,
                    additions: 15,
                    deletions: 8
                }
            }
        ];

        const report = await generator.generateReport(mockCommits);
        expect(report).toBe('模拟的周报内容');
    });
}); 