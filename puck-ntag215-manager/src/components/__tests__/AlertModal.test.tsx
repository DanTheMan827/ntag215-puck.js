import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertModal } from '../AlertModal'
import { ModalResult } from '../../modalTypes'
import { Modal as BsModal } from 'bootstrap'

describe('AlertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the title', () => {
    render(<AlertModal title="Hello World" buttons={[]} />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders the body children', () => {
    render(<AlertModal title="T" buttons={[]}>Body content</AlertModal>)
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('renders without title when title is undefined', () => {
    render(<AlertModal buttons={[]}>Body only</AlertModal>)
    expect(document.querySelector('.modal-title')).toBeNull()
    expect(screen.getByText('Body only')).toBeInTheDocument()
  })

  it('renders footer buttons', () => {
    const buttons = [
      { value: ModalResult.ButtonYes, label: 'Yes' },
      { value: ModalResult.ButtonNo, label: 'No' },
    ]
    render(<AlertModal title="Q" buttons={buttons} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('calls onClose with ButtonYes when Yes is clicked', () => {
    const onClose = vi.fn()
    const buttons = [{ value: ModalResult.ButtonYes, label: 'Yes' }]
    render(<AlertModal title="Q" buttons={buttons} onClose={onClose} />)
    fireEvent.click(screen.getByText('Yes'))
    expect(onClose).toHaveBeenCalledWith(ModalResult.ButtonYes)
  })

  it('calls onClose with ButtonCloseX when the × button is clicked', () => {
    const onClose = vi.fn()
    render(<AlertModal title="T" buttons={[]} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledWith(ModalResult.ButtonCloseX)
  })

  it('hides the × button when preventClose is true', () => {
    render(<AlertModal title="T" buttons={[]} preventClose />)
    expect(screen.queryByLabelText('Close')).toBeNull()
  })

  it('hides the footer when buttons array is empty', () => {
    render(<AlertModal title="T" buttons={[]} />)
    expect(document.querySelector('.modal-footer')).toBeNull()
  })

  it('calls onMount with the Bootstrap Modal instance', () => {
    const onMount = vi.fn()
    render(<AlertModal title="T" buttons={[]} onMount={onMount} />)
    expect(onMount).toHaveBeenCalledTimes(1)
    expect(onMount).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls BsModal.show() on mount', () => {
    render(<AlertModal title="T" buttons={[]} />)
    const instance = (BsModal as unknown as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(instance?.show).toHaveBeenCalledTimes(1)
  })
})
