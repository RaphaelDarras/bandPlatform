import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeactivateDialog } from './DeactivateDialog'

// jsdom@24.1.3 (this project's installed version) does not implement
// HTMLDialogElement.prototype.showModal/close — assign stub implementations
// so DeactivateDialog's real (feature-detected) calls resolve to something
// callable during tests. Drop this shim once jsdom ships these natively.
describe('DeactivateDialog — native <dialog> confirmation (D-22/D-23)', () => {
  let showModalSpy: ReturnType<typeof vi.fn>
  let closeSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    showModalSpy = vi.fn()
    closeSpy = vi.fn()
    HTMLDialogElement.prototype.showModal = showModalSpy as unknown as () => void
    HTMLDialogElement.prototype.close = closeSpy as unknown as (returnValue?: string) => void
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when open is false', () => {
    render(
      <DeactivateDialog open={false} productName="T-Shirt" productTotal={0} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders the title and body copy, and no stock warning when productTotal is 0', () => {
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={0} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('Deactivate T-Shirt?')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This product will be hidden from the catalogue. You can restore it later from the Archived view.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/units in stock/)).not.toBeInTheDocument()
  })

  it('renders the D-23 stock warning when productTotal is 12, and Deactivate stays enabled', () => {
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={12} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.getByText('This product still has 12 units in stock.')).toBeInTheDocument()
    // hidden: true — jsdom applies the UA `dialog:not([open]) { display: none }`
    // rule because the showModal shim below doesn't toggle the `open` attribute
    // the way a real browser does; the element is genuinely present and enabled.
    expect(screen.getByRole('button', { name: 'Deactivate', hidden: true })).not.toBeDisabled()
  })

  it('clicking Deactivate calls onConfirm exactly once and never onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={0} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate', hidden: true }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('clicking Cancel calls onCancel exactly once and never onConfirm', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={0} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls showModal once when transitioning to open', () => {
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={0} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(showModalSpy).toHaveBeenCalledTimes(1)
  })

  it('the dialog element resolves aria-labelledby to the title id', () => {
    render(
      <DeactivateDialog open productName="T-Shirt" productTotal={0} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )
    const heading = screen.getByText('Deactivate T-Shirt?')
    expect(heading).toHaveAttribute('id', 'deactivate-dialog-title')
    const dialog = heading.closest('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby', 'deactivate-dialog-title')
  })
})
