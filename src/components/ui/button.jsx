export function Button({ className = '', children, ...props }) {
  return (
    <button
      className={`px-3 py-2 rounded-2xl btn-primary shadow-sm transition ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}