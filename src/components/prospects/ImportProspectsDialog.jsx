import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, Download, AlertCircle, CheckCircle2, X } from 'lucide-react'

import { useImportProspects, PROSPECT_SOURCES } from '@/api/prospects'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── CSV Template ──────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'Business Name',
  'Contact Name',
  'Email',
  'Phone',
  'Website',
  'Location',
  'Address',
  'Instagram',
  'LinkedIn',
]

const HEADER_TO_FIELD = {
  'business name':  'business_name',
  'businessname':   'business_name',
  'company':        'business_name',
  'company name':   'business_name',
  'business':       'business_name',
  'contact name':   'contact_name',
  'contactname':    'contact_name',
  'contact':        'contact_name',
  'name':           'contact_name',
  'first name':     'contact_name',
  'full name':      'contact_name',
  'email':          'email',
  'email address':  'email',
  'phone':          'phone',
  'phone number':   'phone',
  'mobile':         'phone',
  'whatsapp':       'phone',
  'website':        'website',
  'url':            'website',
  'web':            'website',
  'location':       'location',
  'city':           'location',
  'area':           'location',
  'region':         'location',
  'address':        'address',
  'street address': 'address',
  'full address':   'address',
  'instagram':      'instagram',
  'instagram url':  'instagram',
  'ig':             'instagram',
  'linkedin':       'linkedin',
  'linkedin url':   'linkedin',
  'li':             'linkedin',
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  // Parse a CSV line respecting quoted fields
  function parseLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })

  return { headers, rows }
}

function mapRows(headers, rows) {
  // Map CSV headers to DB fields
  const fieldMap = {}
  headers.forEach((h) => {
    const normalised = h.toLowerCase().trim()
    const field = HEADER_TO_FIELD[normalised]
    if (field) fieldMap[h] = field
  })

  const mapped = []
  const skipped = []
  const duplicateEmails = new Set()

  const emailsSeen = new Set()

  rows.forEach((row, idx) => {
    const record = {}
    Object.entries(fieldMap).forEach(([csvHeader, dbField]) => {
      const val = row[csvHeader]?.trim()
      if (val) record[dbField] = val
    })

    if (!record.business_name) {
      skipped.push(idx + 2) // +2 because 1-indexed and header row
      return
    }

    if (record.email) {
      if (emailsSeen.has(record.email.toLowerCase())) {
        duplicateEmails.add(record.email)
      }
      emailsSeen.add(record.email.toLowerCase())
    }

    mapped.push(record)
  })

  return { mapped, skipped, duplicateEmails: [...duplicateEmails] }
}

function downloadTemplate() {
  const exampleRow = [
    'Acme Studio',
    'Jane Doe',
    'jane@acme.com',
    '+91 98765 43210',
    'https://acme.com',
    'Mumbai, India',
    '12 Link Road, Bandra West',
    '@acmestudio',
    'linkedin.com/company/acme',
  ]
  const csv = [TEMPLATE_HEADERS.join(','), exampleRow.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tercero-prospects-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS = ['upload', 'configure', 'done']

export function ImportProspectsDialog({ open, onOpenChange }) {
  const importProspects = useImportProspects()

  const [step, setStep] = useState('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)   // { mapped, skipped, duplicateEmails }
  const [source, setSource] = useState('manual')
  const [importResult, setImportResult] = useState(null) // { imported, skipped }
  const fileInputRef = useRef(null)

  function reset() {
    setStep('upload')
    setIsDragging(false)
    setFileName('')
    setParsed(null)
    setSource('manual')
    setImportResult(null)
  }

  function handleClose(val) {
    if (!val) reset()
    onOpenChange(val)
  }

  function processFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file')
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const { headers, rows } = parseCSV(text)
      if (!headers.length || !rows.length) {
        toast.error('CSV appears to be empty or invalid')
        return
      }
      const result = mapRows(headers, rows)
      setParsed(result)
      setStep('configure')
    }
    reader.readAsText(file)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  async function handleImport() {
    if (!parsed?.mapped?.length) return
    try {
      const data = await importProspects.mutateAsync({
        rows: parsed.mapped,
        source,
      })
      setImportResult({
        imported: data.length,
        skipped: parsed.skipped.length,
      })
      setStep('done')
    } catch (err) {
      toast.error(err.message || 'Import failed')
    }
  }

  // Preview first 5 rows
  const previewRows = parsed?.mapped?.slice(0, 5) ?? []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Import Prospects</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload a CSV from Apollo, Apify, Google Maps, or our template.
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border'
              )}
            >
              <div className="rounded-full bg-muted p-3">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop your CSV here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports exports from Apollo, Apify, Google Maps, and more
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Template download */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Download our template</p>
                  <p className="text-xs text-muted-foreground">
                    Pre-formatted CSV with the correct column headers
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} type="button">
                <Download className="size-3.5 mr-1.5" />
                Template
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Configure ──────────────────────────────────────────── */}
        {step === 'configure' && parsed && (
          <div className="space-y-4 py-2">
            {/* File info */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsed.mapped.length} prospects detected
                    {parsed.skipped.length > 0 && ` · ${parsed.skipped.length} rows will be skipped (missing Business Name)`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => { reset() }}
                type="button"
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Duplicate warning */}
            {parsed.duplicateEmails.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {parsed.duplicateEmails.length} duplicate email{parsed.duplicateEmails.length > 1 ? 's' : ''} found within this file. All rows will still be imported.
                </p>
              </div>
            )}

            {/* Source selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Where did these leads come from?
              </label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Preview — first {previewRows.length} of {parsed.mapped.length} rows
                </p>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/50">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Business</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Contact</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-b border-border/30 last:border-b-0">
                            <td className="px-3 py-2 font-medium truncate max-w-[120px]">{row.business_name ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{row.contact_name ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{row.email ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{row.location ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Done ───────────────────────────────────────────────── */}
        {step === 'done' && importResult && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-950">
              <CheckCircle2 className="size-7 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold">Import complete</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{importResult.imported}</span> prospect{importResult.imported !== 1 ? 's' : ''} imported
                {importResult.skipped > 0 && (
                  <> · <span className="font-medium">{importResult.skipped}</span> skipped</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={importProspects.isPending || !parsed?.mapped?.length}
              >
                {importProspects.isPending
                  ? 'Importing...'
                  : `Import ${parsed?.mapped?.length ?? 0} Prospects`}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => handleClose(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
