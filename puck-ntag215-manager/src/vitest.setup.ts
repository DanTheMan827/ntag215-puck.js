import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Bootstrap's Modal class — jsdom doesn't support CSS transitions or
// the full DOM APIs that Bootstrap needs. Tests that import from 'bootstrap'
// will receive this stub automatically.
vi.mock('bootstrap', () => ({
  Modal: vi.fn().mockImplementation(function (this: {
    show: ReturnType<typeof vi.fn>
    hide: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }) {
    this.show = vi.fn()
    this.hide = vi.fn()
    this.dispose = vi.fn()
  }),
}))
