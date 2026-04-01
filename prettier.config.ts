import type { Config } from 'prettier'

const config: Config = {
  singleQuote: true,
  semi: false,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: [
    // Sorts Tailwind class names in a consistent, predictable order.
    // This eliminates entire categories of review comments about class ordering.
    'prettier-plugin-tailwindcss',
  ],
}

export default config
