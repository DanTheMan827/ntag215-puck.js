import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import readmeHtml from '../../readme.md'
import ntag215Source from '../../ntag215.js?raw'
import { GithubCorner } from './GithubCorner'
import { SponsorCorner } from './SponsorCorner'

hljs.registerLanguage('javascript', javascript)

const PROJECT_URL = 'https://github.com/DanTheMan827/ntag215-puck.js'

declare const __BUILD_DATE__: string
declare const __GIT_COMMIT__: string

export function App() {
  const codeRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (codeRef.current) {
      const highlighted = hljs.highlight(ntag215Source, { language: 'javascript' }).value
      codeRef.current.innerHTML = highlighted
    }
    // Signal to index.tsx that the App has mounted and DOM elements are ready.
    document.dispatchEvent(new CustomEvent('app:mounted'))
  }, [])

  const shortCommit = __GIT_COMMIT__ !== 'unknown'
    ? __GIT_COMMIT__.substring(0, 7)
    : 'unknown'

  return (
    <>
      <GithubCorner />
      <div className="container" id="mainContainer">
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="puckConnect" disabled>
          Connect to Puck
        </button>
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="updateFirmware" disabled>
          Update Firmware (DFU Mode)
        </button>
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="uploadScript" disabled>
          Upload Script (UART Mode)
        </button>
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="puckDisconnect" disabled>
          Disconnect from Puck
        </button>
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="puckName" disabled>
          Change Name
        </button>
        <button className="btn btn-secondary btn-lg w-100 mb-2" id="puckUart" disabled>
          Enable UART
        </button>

        <div id="readme">
          <div dangerouslySetInnerHTML={{ __html: readmeHtml }} />
          <pre id="code" className="hljs" ref={codeRef} />
          <small id="footer">
            <p>
              Page built on {__BUILD_DATE__} | Commit:{' '}
              <a href={`${PROJECT_URL}/commit/${__GIT_COMMIT__}`}>{shortCommit}</a>
            </p>
          </small>
        </div>

        <div id="slotsContainer" />
      </div>

      <SponsorCorner />
    </>
  )
}
