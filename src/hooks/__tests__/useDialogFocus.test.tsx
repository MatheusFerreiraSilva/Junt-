import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDialogFocus } from '../useDialogFocus';

function Dialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialogFocus(open, onClose);
  return open ? <div ref={ref} role="dialog" tabIndex={-1}><button>Primeiro</button><button>Último</button></div> : null;
}

describe('dialog keyboard behavior', () => {
  it('closes with Escape and restores scrolling and trigger focus', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    const close = vi.fn();
    const view = render(<Dialog open onClose={close} />);
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    view.rerender(<Dialog open={false} onClose={close} />);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(document.body.style.overflow).not.toBe('hidden');
    trigger.remove();
  });
  it('keeps Tab navigation inside the dialog', () => {
    const view = render(<Dialog open onClose={() => {}} />);
    const first = screen.getByText('Primeiro'); const last = screen.getByText('Último');
    vi.spyOn(first, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(last, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    last.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last);
    view.unmount();
  });
});
