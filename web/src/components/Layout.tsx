import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

// Page shell: Header + routed content + Footer on a full-black background.
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
