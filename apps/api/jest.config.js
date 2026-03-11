/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  },
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$'
};
