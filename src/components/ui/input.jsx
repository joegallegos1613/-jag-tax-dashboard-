export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300 ${className}`}
      {...props}
    />
  )
}