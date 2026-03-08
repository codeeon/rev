if (typeof window !== 'undefined') {
  throw new Error('web app spreadsheet operations are server-only')
}
