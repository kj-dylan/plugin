import * as vscode from 'vscode';

export function getVSCodeLanguage(): string {
    // 默认返回中文
    return 'zh';
}

export async function switchReadmeLanguage(forceLanguage?: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    // 强制使用中文
    const currentLanguage = 'zh';
    console.log('Switching README language:', { currentLanguage, forceLanguage });

    // 检查两个文件是否都存在
    const zhReadmePath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'README_zh.md');
    const enReadmePath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'README.md');

    try {
        // 优先尝试打开中文版本
        await vscode.workspace.fs.stat(zhReadmePath);
        const doc = await vscode.workspace.openTextDocument(zhReadmePath);
        await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: false
        });
        console.log(`Successfully switched to ${zhReadmePath.fsPath}`);
    } catch (error) {
        console.error('Failed to open Chinese README:', error);
        // 如果中文版本不存在，尝试打开英文版本
        try {
            const doc = await vscode.workspace.openTextDocument(enReadmePath);
            await vscode.window.showTextDocument(doc);
            console.log(`Fallback to ${enReadmePath.fsPath}`);
        } catch (fallbackError) {
            console.error('Failed to open fallback README:', fallbackError);
            vscode.window.showErrorMessage('无法找到README文件');
        }
    }
} 