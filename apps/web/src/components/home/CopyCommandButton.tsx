import { useState } from 'react';

export function CopyCommandButton({
  command,
  idleLabel,
  doneLabel,
}: {
  command: string;
  idleLabel: string;
  doneLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="hero-copy-button" type="button" onClick={handleCopy}>
      {copied ? doneLabel : idleLabel}
    </button>
  );
}
