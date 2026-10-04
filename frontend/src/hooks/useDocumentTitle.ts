import { useEffect } from 'react'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · RedOak Markets` : 'RedOak Markets - See the market. Understand the trend.'
  }, [title])
}
