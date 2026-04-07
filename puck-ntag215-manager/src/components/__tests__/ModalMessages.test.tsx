import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ModalMessages } from '../ModalMessages'
import { ModalMessageType } from '../../modalMessages'

describe('ModalMessages', () => {
  it('renders save-to-flash message', () => {
    render(<ModalMessages kind={ModalMessageType.SaveToFlash} />)
    expect(screen.getByText(/save written tag data/i)).toBeInTheDocument()
    expect(screen.getByText(/reduce the life/i)).toBeInTheDocument()
  })

  it('renders debug-mode message', () => {
    render(<ModalMessages kind={ModalMessageType.DebugMode} />)
    expect(screen.getByText(/enable debug mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Serial1/i)).toBeInTheDocument()
  })

  it('renders dfu-instructions message', () => {
    render(<ModalMessages kind={ModalMessageType.DfuInstructions} />)
    expect(screen.getByText(/remove the battery/i)).toBeInTheDocument()
    expect(screen.getByText(/LED indicator turns green/i)).toBeInTheDocument()
  })

  it('renders firmware-update progress bar with correct width', () => {
    render(
      <ModalMessages
        kind={ModalMessageType.FirmwareUpdate}
        message="Flashing…"
        currentBytes={250}
        totalBytes={1000}
      />,
    )
    expect(screen.getByText('Flashing…')).toBeInTheDocument()
    expect(screen.getByText(/250 \/ 1000 bytes/)).toBeInTheDocument()
    const bar = document.querySelector('.progress-bar') as HTMLElement
    expect(bar).toBeInTheDocument()
    expect(bar.style.width).toBe('25%')
  })

  it('renders firmware-update with 0 total bytes safely (no NaN)', () => {
    render(
      <ModalMessages
        kind={ModalMessageType.FirmwareUpdate}
        message="Starting"
        currentBytes={0}
        totalBytes={0}
      />,
    )
    const bar = document.querySelector('.progress-bar') as HTMLElement
    expect(bar.style.width).toBe('0%')
  })
})
