module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  globals: {
    // Browser extension globals
    chrome: 'readonly',
    browser: 'readonly',
    
    // Extension-specific globals
    browserCompat: 'readonly',
    TurbodocAPI: 'readonly',
    StorageManager: 'readonly',
    TurbodocPopup: 'readonly',
    TurbodocBackground: 'readonly',
    TurbodocContent: 'readonly'
  },
  rules: {
    // Code style
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    
    // Best practices
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-console': 'warn',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    
    // ES6+
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',
    
    // Async/Await
    'require-await': 'error',
    'no-return-await': 'error',
    
    // Error prevention
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-duplicate-keys': 'error',
    'no-empty': 'error'
  },
  overrides: [
    {
      // Node.js build scripts
      files: ['build/**/*.js'],
      env: {
        node: true,
        browser: false,
        webextensions: false
      },
      globals: {
        chrome: 'off',
        browser: 'off'
      }
    },
    {
      // Test files
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      }
    }
  ]
};