import '@testing-library/jest-dom'

// Polyfill ResizeObserver for recharts (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
