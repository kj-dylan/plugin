// 模拟 vscode 模块
const vscode = {
    workspace: {
        getConfiguration: jest.fn().mockReturnValue({
            get: jest.fn().mockImplementation((key, defaultValue) => defaultValue)
        })
    },
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    }
};

module.exports = {
    vscode
};

// 全局模拟 vscode 模块
jest.mock('vscode', () => {
    return vscode;
}, { virtual: true }); 