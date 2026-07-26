'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Address } from 'viem';
import { Modal } from '@/components/common/modal';
import LayerDetailContent from '@/components/layer/layer-detail-content';

type OpenLayer = {
  contractAddress: Address;
  tokenId: string;
};

type LayerDetailModalContextValue = {
  openLayer: (contractAddress: Address, tokenId: string) => void;
};

const LayerDetailModalContext =
  createContext<LayerDetailModalContextValue | null>(null);

export function useLayerDetailModal(): LayerDetailModalContextValue {
  const ctx = useContext(LayerDetailModalContext);
  if (!ctx) {
    throw new Error(
      'useLayerDetailModal must be used within a LayerDetailModalProvider',
    );
  }
  return ctx;
}

export function LayerDetailModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<OpenLayer | null>(null);
  // Tracks whether the close currently in progress was triggered by a
  // popstate event (browser back button) - if so, the history entry is
  // already gone and we must NOT call history.back() again, or we'd loop /
  // navigate past where the user intended.
  const closingFromPopstateRef = useRef(false);

  const openLayer = useCallback((contractAddress: Address, tokenId: string) => {
    setCurrent({ contractAddress, tokenId });
    window.history.pushState(null, '', `/layer/${contractAddress}/${tokenId}`);
  }, []);

  const closeLayer = useCallback(() => {
    setCurrent(null);
    if (!closingFromPopstateRef.current) {
      window.history.back();
    }
    closingFromPopstateRef.current = false;
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      closingFromPopstateRef.current = true;
      setCurrent(null);
      // Reset immediately: `history.back()` itself (called from closeLayer
      // below) also fires a popstate event, asynchronously, after
      // closeLayer's own synchronous body has already finished and reset
      // the ref to false on its own execution path. Left set here, that
      // ref would stay stuck `true` forever - since nothing else ever
      // clears it - silently skipping `history.back()` on every close
      // button click for the rest of the session. Resetting it here means
      // it only ever affects the single popstate event that produced it.
      closingFromPopstateRef.current = false;
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <LayerDetailModalContext.Provider value={{ openLayer }}>
      {children}
      {current && (
        <Modal title="Layer Details" onClose={closeLayer}>
          <LayerDetailContent
            contractAddress={current.contractAddress}
            tokenId={current.tokenId}
          />
        </Modal>
      )}
    </LayerDetailModalContext.Provider>
  );
}
