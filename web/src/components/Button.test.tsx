import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Button from './Button'

describe('Button', () => {
  it('renders an internal route as a router link', () => {
    render(
      <MemoryRouter>
        <Button to="/listen">Listen Now</Button>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Listen Now' })).toHaveAttribute('href', '/listen')
  })

  it('renders an external href in a new tab with a safe rel', () => {
    render(<Button href="https://shop.hurakanband.fr/">Shop Now</Button>)

    const link = screen.getByRole('link', { name: 'Shop Now' })
    expect(link).toHaveAttribute('href', 'https://shop.hurakanband.fr/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('renders a <button> that fires onClick when given neither to nor href', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Toggle</Button>)

    const button = screen.getByRole('button', { name: 'Toggle' })
    expect(button).toHaveAttribute('type', 'button')
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies a distinct class set per variant so treatments stay separable', () => {
    const { container: primary } = render(<Button href="#">A</Button>)
    const { container: secondary } = render(
      <Button variant="secondary" href="#">
        A
      </Button>,
    )
    const { container: quiet } = render(
      <Button variant="quiet" href="#">
        A
      </Button>,
    )

    const cls = (c: HTMLElement) => c.querySelector('a')!.className
    expect(cls(primary)).toContain('bg-[var(--color-accent)]')
    expect(cls(secondary)).toContain('border')
    expect(cls(quiet)).toContain('underline')
    expect(cls(quiet)).not.toContain('bg-[var(--color-accent)]')
  })
})
