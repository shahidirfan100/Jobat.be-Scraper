export default [
    {
        ignores: ['**/node_modules/**', '**/dist/**']
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                Number: 'readonly',
                String: 'readonly',
                Object: 'readonly',
                Array: 'readonly',
                Promise: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                Error: 'readonly',
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error'
        }
    }
];

