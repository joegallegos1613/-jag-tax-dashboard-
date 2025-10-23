export function Alert({ tone = 'ok', title, children, actions }) {
  const toneClass = tone === 'err' ? 'alert alert-err' : tone === 'warn' ? 'alert alert-warn' : 'alert alert-ok'
  return (
    <div className={toneClass}>
      <div className="flex-1">
        {title ? <div className="font-semibold mb-1">{title}</div> : null}
        <div className="text-sm">{children}</div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}