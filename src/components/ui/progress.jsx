export function Progress({ value = 0 }) {
  return (
    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-3 bg-gray-900" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}