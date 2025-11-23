import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">photoast</h1>
        <p className="text-xl text-gray-600 mb-8">Event Photo Printing Platform</p>
        <Link
          href="/admin"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Admin Dashboard
        </Link>
      </div>
    </div>
  )
}
