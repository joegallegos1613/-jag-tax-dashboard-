export function Badge({ className = '', children }) {
  return <span className={`pill ${className}`}>{children}</span>
}