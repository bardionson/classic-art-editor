'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Address } from 'viem';
import { Modal } from '@/components/common/modal';

type MirrorDialogProps = {
  tokenAddress: Address;
  tokenId: number;
  onClose: () => void;
};

export default function MirrorDialog({
  tokenAddress,
  tokenId,
  onClose,
}: MirrorDialogProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'default' | 'loading' | 'error'>(
    'default',
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;

    setState('loading');
    try {
      const res = await fetch(`/api/mirror/${encodeURIComponent(trimmed)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, tokenId }),
      });

      if (!res.ok) throw new Error('Failed to join mirror session');
      const { role } = await res.json();

      router.push(`/mirror/${encodeURIComponent(trimmed)}/${role}`);
    } catch (err) {
      console.error(err);
      setState('error');
    }
  };

  return (
    <Modal title="Mirror This Artwork" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="mirror-code" className="text-sm font-bold">
          Code Word
        </label>
        <input
          id="mirror-code"
          name="mirror-code"
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full"
          placeholder="e.g. sunset"
        />
        <p className="text-xs text-gray-500 mt-2">
          Enter this same word on a second device to control this artwork&apos;s
          layers remotely. Whichever device submits first becomes the fullscreen
          display; the second becomes the controller.
        </p>
        <button
          disabled={state === 'loading'}
          className="btn btn-black w-full mt-4"
        >
          {state === 'loading' ? 'Connecting...' : 'Go'}
        </button>
        {state === 'error' && (
          <p className="text-red text-sm text-center mt-3" role="alert">
            Unexpected error occured. Please try again.
          </p>
        )}
      </form>
    </Modal>
  );
}
