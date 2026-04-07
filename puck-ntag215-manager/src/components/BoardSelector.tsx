export interface BoardOption {
  name: string
  value: string
  selected?: boolean
}

export interface BoardSelectorProps {
  boards: BoardOption[]
  onChange?: (value: string) => void
}

export function BoardSelector({ boards, onChange }: BoardSelectorProps) {
  const defaultValue = boards.find((b) => b.selected)?.value ?? boards[0]?.value

  return (
    <div>
      <p>
        Please select your Espruino board from the list below; selecting the incorrect option may
        result in unexpected behaviour.
      </p>
      <select
        className="form-select"
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {boards.map((b) => (
          <option key={b.value} value={b.value}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
