import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/dist/**','**/node_modules/**','.wrangler/**','playwright-report/**','test-results/**']},js.configs.recommended,...tseslint.configs.recommended,{files:['scripts/**/*.mjs'],languageOptions:{globals:{URL:'readonly',process:'readonly',console:'readonly',fetch:'readonly',AbortSignal:'readonly',TextDecoder:'readonly'}}},{files:['**/*.ts','**/*.tsx'],rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}});
