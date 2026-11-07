import '@testing-library/jest-dom'

// Polyfill ResizeObserver for recharts (not available in jsdom)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
