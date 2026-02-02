export function AppBody({ children }) {
  return (
    // Removed p-4 to let PostDetails handle its own internal spacing
    // Added overflow-x-hidden to prevent the horizontal jump
    <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
      {children}
    </main>
  )
}
