import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="w-full max-w-4xl p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Telegram Maintenance Tracker
          </h1>
          <p className="text-lg text-gray-600">
            Manage tickets, users, and locations from your Telegram group
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Dashboard Card */}
          <Link href="/dashboard">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="text-4xl mb-4">🎫</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Dashboard
              </h2>
              <p className="text-gray-600">
                View and manage maintenance tickets from Telegram
              </p>
            </div>
          </Link>

          {/* User Master Card */}
          <Link href="/masters/users">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
              <div className="text-4xl mb-4">👥</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                User Master
              </h2>
              <p className="text-gray-600">
                Manage synced Telegram users and their roles
              </p>
            </div>
          </Link>

          {/* Location Master Card */}
          <Link href="/masters/locations">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500">
              <div className="text-4xl mb-4">📍</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Location Master
              </h2>
              <p className="text-gray-600">
                Manage locations, rooms, and facilities
              </p>
            </div>
          </Link>

          {/* Category Master Card */}
          <Link href="/masters/categories">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-500">
              <div className="text-4xl mb-4">🏷️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Category Master
              </h2>
              <p className="text-gray-600">
                Manage categories and auto-detection keywords
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Quick Start
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li>• View tickets created from Telegram messages</li>
            <li>• Sync users from your Telegram group</li>
            <li>• Manage locations extracted from tickets</li>
            <li>• Mark tickets as completed with "Done" reply</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
