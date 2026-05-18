import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🔬</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Lab Equipment Scheduler</h1>
        <p className="text-base text-gray-700 font-medium mb-2">
          Share equipment time fairly — no conflicts, no overlapping bookings.
        </p>
        <p className="text-sm text-gray-600 mb-8">
          Create a schedule for your equipment, share the link with your lab groups. Each group picks an open slot.
        </p>

        <Link
          href="/create"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl text-base transition-colors shadow-sm"
        >
          Create Equipment Schedule
        </Link>

        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-xs font-medium text-gray-700">Create</div>
            <div className="text-xs text-gray-400 mt-0.5">Set equipment &amp; time range</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl mb-1">🔗</div>
            <div className="text-xs font-medium text-gray-700">Share</div>
            <div className="text-xs text-gray-400 mt-0.5">Send link to your groups</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl mb-1">✅</div>
            <div className="text-xs font-medium text-gray-700">Book</div>
            <div className="text-xs text-gray-400 mt-0.5">Pick a free slot, no conflicts</div>
          </div>
        </div>
      </div>
    </div>
  );
}
