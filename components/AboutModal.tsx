'use client';

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">About LabSlot</h2>

        <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
          <p>
            <strong>LabSlot</strong> is a fair and simple equipment scheduling tool designed for lab groups and research teams.
          </p>

          <p>
            Share equipment time without conflicts. Create a schedule, share the link with your team, and let everyone book their slots in a transparent, first-come-first-served manner.
          </p>

          <h3 className="font-semibold text-gray-900 mt-4">Features:</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Easy setup — no accounts needed</li>
            <li>Real-time availability — see bookings instantly</li>
            <li>Flexible scheduling — daily, weekly, or monthly views</li>
            <li>Edit & manage — full control over your bookings</li>
            <li>Fair access — everyone gets equal visibility</li>
          </ul>

          <p className="pt-2">
            Built to make lab resource management simple, transparent, and stress-free.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
