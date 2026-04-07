import { useEffect, useRef, type ReactNode } from 'react'
import { Modal as BsModal } from 'bootstrap'
import { ModalResult, type ModalTemplateButton } from '../modalTypes'

export interface AlertModalProps {
  title?: string
  children?: ReactNode
  buttons?: ModalTemplateButton[]
  preventClose?: boolean
  onClose?: (result: ModalResult) => void
  /** Called once the Bootstrap Modal instance is created, so modal.ts can hold a reference to it. */
  onMount?: (instance: BsModal) => void
}

export function AlertModal({
  title,
  children,
  buttons = [],
  preventClose = false,
  onClose,
  onMount,
}: AlertModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const bsRef = useRef<BsModal | null>(null)

  // Keep a ref to onClose so the stable click handlers always call the latest version.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = modalRef.current!
    const bs = new BsModal(el, { backdrop: 'static', keyboard: false })
    bsRef.current = bs
    onMount?.(bs)
    bs.show()
    return () => {
      bs.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — Bootstrap instance is created once on mount

  const handleClose = (result: ModalResult) => {
    onCloseRef.current?.(result)
  }

  return (
    <div
      id="alertModal"
      className="modal fade"
      ref={modalRef}
      tabIndex={-1}
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <div className="modal-content">
          {title != null && (
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              {!preventClose && (
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => handleClose(ModalResult.ButtonCloseX)}
                />
              )}
            </div>
          )}
          <div className="modal-body">{children}</div>
          {buttons.length > 0 && (
            <div className="modal-footer">
              {buttons.map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  className="btn btn-secondary"
                  data-close-value={btn.value}
                  onClick={() => handleClose(btn.value)}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
