import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // vite-react-ssg: emit nested dir HTML (discography/index.html) for clean
  // URLs on Vercel and to match route paths one-to-one.
  ssgOptions: {
    dirStyle: 'nested',
  },
})
