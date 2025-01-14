module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    setupFiles: ['<rootDir>/src/__tests__/jest.setup.ts'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/__tests__/jest.setup.ts'
    }
}; 