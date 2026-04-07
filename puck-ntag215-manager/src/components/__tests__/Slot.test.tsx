import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Slot } from '../Slot'

const defaultProps = {
  slot: 0,
  uid: '0102030405060708',
  onDownload: vi.fn(),
  onUpload: vi.fn(),
  onClear: vi.fn(),
  onSelect: vi.fn(),
}

describe('Slot', () => {
  it('renders the slot number as 1-based', () => {
    render(<Slot {...defaultProps} slot={0} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders slot 4 as "5"', () => {
    render(<Slot {...defaultProps} slot={4} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders the UID when provided', () => {
    render(<Slot {...defaultProps} />)
    expect(screen.getByText('0102030405060708')).toBeInTheDocument()
  })

  it('does not render UID row when uid is undefined', () => {
    render(<Slot {...defaultProps} uid={undefined} />)
    expect(screen.queryByText(/UID/i)).toBeNull()
  })

  it('calls onDownload when Download is clicked', () => {
    const onDownload = vi.fn()
    render(<Slot {...defaultProps} onDownload={onDownload} />)
    fireEvent.click(screen.getByText('Download'))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('calls onUpload when Upload is clicked', () => {
    const onUpload = vi.fn()
    render(<Slot {...defaultProps} onUpload={onUpload} />)
    fireEvent.click(screen.getByText('Upload'))
    expect(onUpload).toHaveBeenCalledTimes(1)
  })

  it('calls onClear when Clear is clicked', () => {
    const onClear = vi.fn()
    render(<Slot {...defaultProps} onClear={onClear} />)
    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('calls onSelect when Select is clicked', () => {
    const onSelect = vi.fn()
    render(<Slot {...defaultProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Select'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('prevents default on link clicks', () => {
    render(<Slot {...defaultProps} />)
    const link = screen.getByText('Download')
    const event = fireEvent.click(link)
    // fireEvent returns false if preventDefault was called
    expect(event).toBe(false)
  })

  it('renders all four action links', () => {
    render(<Slot {...defaultProps} />)
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('Select')).toBeInTheDocument()
  })
})
