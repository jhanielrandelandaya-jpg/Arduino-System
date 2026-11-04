import { useEffect, useRef, useState } from 'react'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const textExtensions = new Set([
  'txt', 'md', 'log', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts',
  'jsx', 'tsx', 'yml', 'yaml', 'ini', 'sql', 'py', 'java', 'c', 'cpp', 'h',
  'sh', 'bat', 'ps1', 'svg', 'rtf', 'env', 'conf', 'toml', 'properties',
  'jsonl', 'graphql', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'vue',
])
const imageExtensions = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'tif', 'tiff', 'svg',
])
const spreadsheetNamespace =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const relationshipNamespace =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRelationshipNamespace =
  'http://schemas.openxmlformats.org/package/2006/relationships'

function parseDelimitedText(text, delimiter) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function getWorksheetRows(worksheet) {
  return worksheet.rows
}

function parseXml(zip, fileName) {
  const contents = zip[fileName]
  if (!contents) throw new Error('The spreadsheet is missing required data.')
  const xml = new DOMParser().parseFromString(
    new TextDecoder().decode(contents),
    'application/xml',
  )
  if (xml.getElementsByTagName('parsererror').length) {
    throw new Error('The spreadsheet contains invalid XML.')
  }
  return xml
}

function normalizeZipPath(fileName) {
  const segments = []
  for (const segment of fileName.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment && segment !== '.') segments.push(segment)
  }
  return segments.join('/')
}

function columnIndex(reference) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase()
  if (!letters) return -1
  return [...letters].reduce(
    (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1
}

function getTextContent(element) {
  return [...element.getElementsByTagNameNS(spreadsheetNamespace, 't')]
    .map((node) => node.textContent || '')
    .join('')
}

function parseXlsx(zip) {
  const workbookXml = parseXml(zip, 'xl/workbook.xml')
  const relationshipsXml = parseXml(zip, 'xl/_rels/workbook.xml.rels')
  const relationships = new Map(
    [...relationshipsXml.getElementsByTagNameNS(
      packageRelationshipNamespace,
      'Relationship',
    )].map((relationship) => [
      relationship.getAttribute('Id'),
      normalizeZipPath(
        relationship.getAttribute('Target').startsWith('/')
          ? relationship.getAttribute('Target')
          : `xl/${relationship.getAttribute('Target')}`,
      ),
    ]),
  )
  const sharedStrings = zip['xl/sharedStrings.xml']
    ? [...parseXml(zip, 'xl/sharedStrings.xml').getElementsByTagNameNS(
        spreadsheetNamespace,
        'si',
      )].map(getTextContent)
    : []
  const worksheets = [
    ...workbookXml.getElementsByTagNameNS(spreadsheetNamespace, 'sheet'),
  ].map((sheet, sheetIndex) => {
    const target = relationships.get(
      sheet.getAttributeNS(relationshipNamespace, 'id'),
    )
    if (!target) throw new Error('The spreadsheet contains an invalid sheet.')
    const sheetXml = parseXml(zip, target)
    const rows = [
      ...sheetXml.getElementsByTagNameNS(spreadsheetNamespace, 'row'),
    ].map((rowElement) => {
      const row = []
      for (const cell of rowElement.getElementsByTagNameNS(
        spreadsheetNamespace,
        'c',
      )) {
        const index = columnIndex(cell.getAttribute('r'))
        if (index < 0) continue
        const type = cell.getAttribute('t')
        const value = cell.getElementsByTagNameNS(spreadsheetNamespace, 'v')[0]
        const displayValue =
          type === 'inlineStr'
            ? getTextContent(cell)
            : type === 's'
              ? sharedStrings[Number(value?.textContent)] || ''
              : type === 'b'
                ? value?.textContent === '1' ? 'TRUE' : 'FALSE'
                : value?.textContent || ''
        row[index] = displayValue
      }
      return Array.from({ length: row.length }, (_, index) => row[index] || '')
    })
    return {
      id: sheet.getAttribute('name') || String(sheetIndex),
      name: sheet.getAttribute('name') || `Sheet ${sheetIndex + 1}`,
      rows,
    }
  })

  if (!worksheets.length) {
    throw new Error('This spreadsheet does not contain any worksheets.')
  }
  return worksheets
}

function SpreadsheetPreview({ file, extension }) {
  const [workbook, setWorkbook] = useState(null)
  const [sheetName, setSheetName] = useState('')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    let active = true
    const loadSpreadsheet = async () => {
      try {
        if (extension === 'csv' || extension === 'tsv') {
          const text = await file.blob.text()
          if (active) {
            setRows(parseDelimitedText(text, extension === 'csv' ? ',' : '\t'))
            setWorkbook({ sheetNames: [] })
          }
          return
        }

        const { unzipSync } = await import('fflate')
        const zip = unzipSync(new Uint8Array(await file.blob.arrayBuffer()))
        const worksheets = parseXlsx(zip)
        if (active) {
          setWorkbook({ worksheets })
          setSheetName(worksheets[0]?.name || '')
          setRows(worksheets[0] ? getWorksheetRows(worksheets[0]) : [])
        }
      } catch (parseError) {
        if (active) {
          setError(
            parseError.message || 'This spreadsheet could not be displayed.',
          )
        }
      }
    }
    loadSpreadsheet()

    return () => {
      active = false
    }
  }, [extension, file.blob])

  if (error) return <p className="lms-classroom-error" role="alert">{error}</p>
  if (!workbook) {
    return (
      <p className="lms-pdf-preview-message" role="status">
        Loading spreadsheet preview...
      </p>
    )
  }

  return (
    <div className="lms-spreadsheet-preview">
      {workbook.worksheets?.length > 1 && (
        <div className="lms-spreadsheet-tabs" aria-label="Spreadsheet sheets">
          {workbook.worksheets.map((worksheet) => (
            <button
              type="button"
              key={worksheet.id}
              className={sheetName === worksheet.name ? 'is-active' : ''}
              onClick={() => {
                setSheetName(worksheet.name)
                setRows(getWorksheetRows(worksheet))
              }}
            >
              {worksheet.name}
            </button>
          ))}
        </div>
      )}
      <div className="lms-spreadsheet-table-wrap">
        <table className="lms-spreadsheet-table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  rowIndex === 0
                    ? <th key={cellIndex}>{String(cell ?? '')}</th>
                    : <td key={cellIndex}>{String(cell ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function StudentAttachmentPreview({ file }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const extension = file.fileName.split('.').pop()?.toLowerCase() || ''

  useEffect(() => {
    let active = true
    let documentTask
    let pdfDocument
    let pptxViewer
    const renderTasks = []

    const renderFile = async () => {
      try {
        if (extension === 'pdf') {
          const pdfjs = await import('pdfjs-dist')
          if (!active) return
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
          documentTask = pdfjs.getDocument({ data: await file.blob.arrayBuffer() })
          pdfDocument = await documentTask.promise
          if (!active || !containerRef.current) return

          const container = containerRef.current
          container.replaceChildren()
          for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber)
            if (!active) return
            const baseViewport = page.getViewport({ scale: 1 })
            const scale = Math.min(1.5, (container.clientWidth - 24) / baseViewport.width)
            const viewport = page.getViewport({ scale: Math.max(scale, 0.5) })
            const canvas = document.createElement('canvas')
            canvas.className = 'lms-pdf-preview-page'
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            container.append(canvas)
            const renderTask = page.render({ canvas, viewport })
            renderTasks.push(renderTask)
            await renderTask.promise
          }
        } else if (['docx', 'docm', 'dotx', 'dotm'].includes(extension)) {
          const docx = await import('docx-preview')
          if (!active || !containerRef.current) return
          await docx.renderAsync(
            file.blob,
            containerRef.current,
            undefined,
            { breakPages: true, renderHeaders: true, renderFooters: true },
          )
        } else if (['pptx', 'pptm', 'ppsx', 'potx', 'potm'].includes(extension)) {
          const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
            '@aiden0z/pptx-renderer'
          )
          if (!active || !containerRef.current) return
          pptxViewer = await PptxViewer.open(
            await file.blob.arrayBuffer(),
            containerRef.current,
            {
              externalMedia: 'block',
              lazyMedia: true,
              lazySlides: true,
              zipLimits: RECOMMENDED_ZIP_LIMITS,
            },
          )
        } else if (textExtensions.has(extension)) {
          const text = await file.blob.text()
          if (!active || !containerRef.current) return
          const pre = document.createElement('pre')
          pre.className = 'lms-text-preview'
          pre.textContent = text
          containerRef.current.replaceChildren(pre)
        } else {
          throw new Error(
            'This format cannot be rendered in the browser. Ask your teacher to share it as PDF, DOCX, PPTX, XLSX, XLSM, CSV, TSV, image, text, audio, or video.',
          )
        }

        if (active) setLoading(false)
      } catch (renderError) {
        if (active) {
          setError(renderError.message || 'This file could not be displayed.')
          setLoading(false)
        }
      }
    }

    renderFile()

    return () => {
      active = false
      renderTasks.forEach((task) => {
        try {
          task.cancel()
        } catch {
          // The task may have already finished; nothing to cancel.
        }
      })
      documentTask?.destroy().catch(() => {})
      try {
        pptxViewer?.destroy()
      } catch {
        // Ignore teardown errors so closing the preview never breaks the page.
      }
    }
  }, [extension, file.blob])

  if (
    ['xlsx', 'xlsm', 'csv', 'tsv'].includes(extension)
  ) {
    return <SpreadsheetPreview file={file} extension={extension} />
  }
  if (imageExtensions.has(extension)) {
    return (
      <div className="lms-file-preview-image-wrap">
        <img className="lms-attachment-preview-image" src={file.url} alt={file.fileName} />
      </div>
    )
  }
  if (['mp4', 'webm', 'ogv', 'mov'].includes(extension)) {
    return (
      <video className="lms-file-preview-media" src={file.url} controls>
        Your browser cannot play this video format.
      </video>
    )
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
    return (
      <audio className="lms-file-preview-audio" src={file.url} controls>
        Your browser cannot play this audio format.
      </audio>
    )
  }

  return (
    <div className="lms-pdf-preview">
      {loading && <p className="lms-pdf-preview-message" role="status">Loading file preview...</p>}
      {error && <p className="lms-classroom-error" role="alert">{error}</p>}
      {['pptx', 'pptm', 'ppsx', 'potx', 'potm'].includes(extension) && (
        <div ref={containerRef} className="lms-pptx-preview" />
      )}
      <div
        className={`lms-pdf-preview-pages ${
          ['docx', 'docm', 'dotx', 'dotm'].includes(extension)
            ? 'lms-docx-preview'
            : ''
        }`}
        ref={
          ['pptx', 'pptm', 'ppsx', 'potx', 'potm'].includes(extension)
            ? undefined
            : containerRef
        }
      />
    </div>
  )
}
