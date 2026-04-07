import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BoardSelector } from '../BoardSelector'

const boards = [
  { name: 'Bangle.js', value: 'bangle' },
  { name: 'Puck.js', value: 'puck', selected: true },
  { name: 'Pixl.js', value: 'pixl' },
]

describe('BoardSelector', () => {
  it('renders all board options', () => {
    render(<BoardSelector boards={boards} />)
    expect(screen.getByText('Bangle.js')).toBeInTheDocument()
    expect(screen.getByText('Puck.js')).toBeInTheDocument()
    expect(screen.getByText('Pixl.js')).toBeInTheDocument()
  })

  it('defaults to the board marked selected', () => {
    render(<BoardSelector boards={boards} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('puck')
  })

  it('defaults to the first board when none is marked selected', () => {
    const noDefault = boards.map(({ selected: _s, ...rest }) => rest)
    render(<BoardSelector boards={noDefault} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('bangle')
  })

  it('calls onChange when the selection changes', () => {
    const onChange = vi.fn()
    render(<BoardSelector boards={boards} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pixl' } })
    expect(onChange).toHaveBeenCalledWith('pixl')
  })

  it('renders the description paragraph', () => {
    render(<BoardSelector boards={boards} />)
    expect(screen.getByText(/select your Espruino board/i)).toBeInTheDocument()
  })
})
