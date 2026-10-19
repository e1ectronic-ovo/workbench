import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

const vueRecommendedRules = Object.assign(
  {},
  ...pluginVue.configs['flat/recommended'].filter((c) => c.rules).map((c) => c.rules)
)

// 关掉会带来大量纯样式改动、与现有代码风格冲突的 Vue 规则
const vueStylisticOff = {
  'vue/max-attributes-per-line': 'off',
  'vue/attributes-order': 'off',
  'vue/singleline-html-element-content-newline': 'off',
  'vue/multiline-html-element-content-newline': 'off',
  'vue/html-self-closing': 'off',
  'vue/html-indent': 'off',
  'vue/comment-directive': 'off'
}

export default tseslint.config(
  {
    ignores: [
      'out/**',
      'release/**',
      'dist/**',
      'node_modules/**',
      '*.config.ts',
      'scripts/**',
      '.agents/**',
      '**/*.d.ts'
    ]
  },
  js.configs.recommended,
  prettier,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.vue'],
    plugins: { vue: pluginVue },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: { ...vueRecommendedRules, ...vueStylisticOff }
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.browser,
        window: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'vue/multi-word-component-names': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/no-v-html': 'off'
    }
  }
)
