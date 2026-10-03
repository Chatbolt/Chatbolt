import React, { useState, useEffect } from 'react'
import { X, Download, ExternalLink, FileText, Copy, Check } from 'lucide-react'
import { TERMINAL_STRINGS } from './strings'

interface Artifact {
  id: string
  name: string
  type: string
  content?: string
  downloadUrl?: string
}

interface ArtifactPanelProps {
  artifact: Artifact | null
  onClose: () => void
}

export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const [csvRows, setCsvRows] = useState<string[][]>([])

  useEffect(() => {
    if (artifact?.type === 'csv' && artifact.content) {
      const rows = artifact.content
        .split('\n')
        .map(row => row.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim()))
        .filter(row => row.some(cell => cell.length > 0))
      setCsvRows(rows)
    }
  }, [artifact])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!artifact) return null

  const handleCopy = () => {
    if (!artifact.content) return
    navigator.clipboard.writeText(artifact.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isHtml = artifact.type === 'html' || artifact.type === 'web' || artifact.name.endsWith('.html')
  const isCsv = artifact.type === 'csv' || artifact.name.endsWith('.csv')
  const isImage = artifact.type === 'screenshot' || artifact.type === 'image' || artifact.name.endsWith('.png') || artifact.name.endsWith('.jpg') || artifact.name.endsWith('.jpeg')

  return (
    <div className="artifact-panel h-full bg-surface border-l border-border flex flex-col shadow-lg animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-subtle/50">
        <div className="flex items-center gap-2">
          <FileText className="text-secondary" size={16} />
          <h4 className="text-xs font-semibold text-primary truncate max-w-[200px]" title={artifact.name}>
            {artifact.name}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {artifact.downloadUrl && (
            <a
              href={artifact.downloadUrl}
              download
              title={TERMINAL_STRINGS.download}
              className="p-1.5 hover:bg-secondary border border-border rounded-md text-secondary hover:text-primary transition-all"
            >
              <Download size={14} />
            </a>
          )}
          {isHtml && artifact.downloadUrl && (
            <a
              href={artifact.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={TERMINAL_STRINGS.openInNewTab}
              className="p-1.5 hover:bg-secondary border border-border rounded-md text-secondary hover:text-primary transition-all flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2"
            >
              <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-secondary border border-transparent rounded-md text-secondary hover:text-primary transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Renderers content area */}
      <div className="flex-1 overflow-auto p-5 custom-scrollbar min-h-0 bg-background">
        
        {/* Sandboxed HTML Frame */}
        {isHtml && (
          <div className="w-full h-full border border-border rounded-lg overflow-hidden bg-white shadow-xs">
            <iframe
              srcDoc={artifact.content}
              title={artifact.name}
              sandbox="allow-scripts"
              className="w-full h-full border-0"
            />
          </div>
        )}

        {/* CSV Render Table */}
        {isCsv && csvRows.length > 0 && (
          <div className="w-full border border-border rounded-lg overflow-hidden bg-surface max-h-full overflow-auto custom-scrollbar shadow-xs">
            <table className="w-full border-collapse text-left text-xs text-primary">
              <thead className="bg-subtle text-primary font-semibold sticky top-0 border-b border-border">
                <tr>
                  {csvRows[0].map((header, idx) => (
                    <th key={idx} className="p-2.5 border-r border-border text-[11px] font-semibold uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {csvRows.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-subtle/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2.5 border-r border-border">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Image / Screenshot Viewer */}
        {isImage && (
          <div className="w-full h-full flex items-center justify-center border border-border rounded-lg overflow-hidden bg-surface p-2 shadow-xs">
            <img
              src={artifact.content}
              alt={artifact.name}
              className="max-w-full max-h-full object-contain rounded-md"
            />
          </div>
        )}

        {/* Code / Text Viewer */}
        {!isHtml && !isCsv && !isImage && (
          <div className="relative border border-border rounded-lg bg-surface p-4 font-mono text-xs text-primary overflow-auto leading-relaxed custom-scrollbar shadow-xs">
            {artifact.content && (
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-1.5 bg-secondary hover:bg-subtle border border-border rounded-md text-primary transition-all flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 cursor-pointer shadow-xs"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-emerald-700" />
                    <span className="text-emerald-800">{TERMINAL_STRINGS.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>{TERMINAL_STRINGS.copyCode}</span>
                  </>
                )}
              </button>
            )}
            <pre className="whitespace-pre-wrap font-mono">{artifact.content || 'Empty file'}</pre>
          </div>
        )}

      </div>
    </div>
  )
}
