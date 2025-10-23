import React from 'react'

export function Tabs({ defaultValue, children }) {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <div>
      {React.Children.map(children, child => {
        if (!child) return null
        if (child.type?.displayName === 'TabsList') return React.cloneElement(child, { value, setValue })
        if (child.type?.displayName === 'TabsContent') return React.cloneElement(child, { value })
        return child
      })}
    </div>
  )
}

export function TabsList({ value, setValue, className = '', children }) {
  return <div className={`inline-flex gap-2 border rounded-xl p-1 ${className}`}>
    {React.Children.map(children, child => React.cloneElement(child, { value, setValue }))}
  </div>
}
TabsList.displayName = 'TabsList'

export function TabsTrigger({ value: tabValue, value: _ignored, setValue, children }) {
  return (
    <button onClick={() => setValue(tabValue)} className={`px-3 py-1 rounded-lg text-sm ${_ignored === tabValue ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>
      {children}
    </button>
  )
}
TabsTrigger.displayName = 'TabsTrigger'

export function TabsContent({ value, value: tabValue, className = '', children }) {
  if (value !== tabValue) return null
  return <div className={className}>{children}</div>
}
TabsContent.displayName = 'TabsContent'