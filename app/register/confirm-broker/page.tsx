import { Suspense } from 'react'
import ConfirmBrokerContent from './_components/confirm-broker-content'

export default function ConfirmBrokerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ConfirmBrokerContent />
    </Suspense>
  )
}
