import { ModalMessageType } from '../modalMessages'

export interface ModalMessagesProps {
  kind: ModalMessageType
  message?: string
  currentBytes?: number
  totalBytes?: number
}

export function ModalMessages({
  kind,
  message = '',
  currentBytes = 0,
  totalBytes = 1,
}: ModalMessagesProps) {
  switch (kind) {
    case ModalMessageType.SaveToFlash:
      return (
        <>
          <p>Do you want to save written tag data to the flash storage of the puck?</p>
          <p>
            If this feature is not enabled, the tags stored on the puck will be lost when the
            battery dies or if it is removed.
          </p>
          <p>
            This may reduce the life of the puck due to the additional writes to the flash storage.
          </p>
        </>
      )

    case ModalMessageType.DebugMode:
      return (
        <>
          <p>Do you want to enable debug mode?</p>
          <p>
            This will enable log output and use &quot;Serial1&quot; as a console when fast mode is
            enabled.
          </p>
        </>
      )

    case ModalMessageType.DfuInstructions:
      return (
        <p>
          To enter DFU mode, please remove the battery from your Puck.js and re-insert it while
          holding the power button until the LED indicator turns green.
        </p>
      )

    case ModalMessageType.FirmwareUpdate: {
      const pct = totalBytes > 0 ? (currentBytes / totalBytes) * 100 : 0
      return (
        <>
          <p>{message}</p>
          <p>
            {currentBytes} / {totalBytes} bytes
          </p>
          <div className="progress" style={{ marginBottom: 0 }}>
            <div
              className="progress-bar bg-info"
              role="progressbar"
              style={{ width: `${pct}%` }}
              aria-valuenow={currentBytes}
              aria-valuemin={0}
              aria-valuemax={totalBytes}
            />
          </div>
        </>
      )
    }

    default:
      return null
  }
}
