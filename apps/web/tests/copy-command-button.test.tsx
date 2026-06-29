import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyCommandButton } from '../src/components/home/CopyCommandButton';

function installClipboard(writeText: Clipboard['writeText']) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CopyCommandButton', () => {
  it('copies the command and resets the confirmation label', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);

    render(
      <CopyCommandButton
        command="pnpm install"
        idleLabel="Copy command"
        doneLabel="Copied"
      />,
    );

    const button = screen.getByRole('button', { name: 'Copy command' });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('pnpm install');
    expect(button.textContent).toBe('Copied');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800);
    });

    expect(button.textContent).toBe('Copy command');
  });

  it('keeps the idle label when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    installClipboard(writeText);

    render(
      <CopyCommandButton
        command="pnpm install"
        idleLabel="Copy command"
        doneLabel="Copied"
      />,
    );

    const button = screen.getByRole('button', { name: 'Copy command' });
    await userEvent.click(button);

    expect(writeText).toHaveBeenCalledWith('pnpm install');
    expect(button.textContent).toBe('Copy command');
  });
});
