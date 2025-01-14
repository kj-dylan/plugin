import * as vscode from 'vscode';

export class MockOutputChannel implements vscode.OutputChannel {
    private content: string[] = [];
    name: string = 'Mock Output Channel';

    append(value: string): void {
        this.content.push(value);
    }

    appendLine(value: string): void {
        this.content.push(value + '\n');
    }

    clear(): void {
        this.content = [];
    }

    replace(value: string): void {
        if (this.content.length > 0) {
            this.content[this.content.length - 1] = value;
        } else {
            this.content.push(value);
        }
    }

    show(): void { }
    hide(): void { }
    dispose(): void { }

    // 添加一个方法用于测试
    getContent(): string {
        return this.content.join('');
    }
} 