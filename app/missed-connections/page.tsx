import { redirect } from 'next/navigation'

// Keep the concept independent of the PhotoToast layout, auth and client bundle.
export default function MissedConnectionsPrototypeEntry() {
  redirect('/missed-connections/index.html')
}
