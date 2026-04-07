export interface SlotProps {
  /** Zero-based slot index. Displayed as slot + 1. */
  slot: number
  uid?: string
  onDownload: () => void
  onUpload: () => void
  onClear: () => void
  onSelect: () => void
}

export function Slot({ slot, uid, onDownload, onUpload, onClear, onSelect }: SlotProps) {
  return (
    <div className="card slot">
      <div className="card-body">
        <div className="slot-title">{slot + 1}</div>
        <div className="slot-summary">
          {uid && (
            <div>
              <b>UID: </b>
              <span>{uid}</span>
            </div>
          )}
          <ul className="slot-links">
            <li>
              <a
                href="#"
                className="slot-download-link"
                onClick={(e) => {
                  e.preventDefault()
                  onDownload()
                }}
              >
                Download
              </a>
            </li>
            <li>
              <a
                href="#"
                className="slot-upload-link"
                onClick={(e) => {
                  e.preventDefault()
                  onUpload()
                }}
              >
                Upload
              </a>
            </li>
            <li>
              <a
                href="#"
                className="slot-clear-link"
                onClick={(e) => {
                  e.preventDefault()
                  onClear()
                }}
              >
                Clear
              </a>
            </li>
            <li>
              <a
                href="#"
                className="slot-select-link"
                onClick={(e) => {
                  e.preventDefault()
                  onSelect()
                }}
              >
                Select
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
