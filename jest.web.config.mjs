// Frontend unit tests (src/**/__tests__). The server suite runs separately
// with the default config (`jest server`); both run from `npm test`.
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
});
