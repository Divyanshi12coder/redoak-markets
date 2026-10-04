import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui/States'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="container-page py-20">
      <EmptyState
        icon="alert"
        title="This page does not exist"
        description="The link may be outdated, or the address mistyped."
        action={
          <div className="flex gap-2">
            <Link to="/" className="btn btn-primary">Back to home</Link>
            <Link to="/analyze" className="btn btn-secondary">Analyze a stock</Link>
          </div>
        }
      />
    </div>
  )
}
