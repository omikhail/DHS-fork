/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          types: ['jest', 'node'],
          esModuleInterop: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'helpers/**/*.ts',
    'transport/**/*.ts',
    '!**/*.d.ts',
  ],
};
