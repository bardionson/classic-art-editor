import { useState, useEffect, useRef } from 'react';
import LayerThumbnail from '@/components/layer/layer-thumbnail';
import { getLayerStatePreviews } from '@/utils/layer-state-previews';
import type { MasterArtNFTMetadata } from '@/types/shared';
import { Modal } from '@/components/common/modal';
import { Address, getContract } from 'viem';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ACTIVE_NETWORK } from '@/config';
import {
  initialControlValues,
  readControlValues,
  changedControlValues,
  ownsControl,
} from '@/utils/layer-controls';
import { publicClient } from '@/utils/rpcClient';
import { getAbiForAddress } from '@/utils/contract-helpers';
import { useLayerDetailModal } from '@/components/layer/layer-detail-provider';

type Control = {
  minValue: number;
  maxValue: number;
  startValue?: number;
  label: string;
  controlType: string;
  stateLabels?: string[];
};

type LayerControlDialogProps = {
  layer: any;
  isOpen: boolean;
  onClose: () => void;
  onPreview: (controlTokenId: string, values: Record<string, number>) => void;
  currentValues: Record<string, number>;
  contractAddress?: Address;
  isMusic?: boolean;
  masterTokenId?: number;
  metadataLayers?: MasterArtNFTMetadata['layout']['layers'];
};

export default function LayerControlDialog({
  layer,
  isOpen,
  onClose,
  onPreview,
  currentValues,
  contractAddress,
  isMusic = false,
  masterTokenId,
  metadataLayers,
}: LayerControlDialogProps) {
  const { address, chainId } = useAccount();
  const { openLayer } = useLayerDetailModal();
  const {
    writeContract,
    isPending,
    isSuccess: isSubmitted,
    isError: isSubmitError,
    error: submitError,
    data: txHash,
    reset: resetWrite,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    isError: isConfirmError,
  } = useWaitForTransactionReceipt({ hash: txHash });
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [ownerCheckFailed, setOwnerCheckFailed] = useState(false);
  // Snapshot of what was actually submitted on-chain, captured at submit
  // time. The confirmation effect below reads from this ref rather than the
  // live `layer`/`localValues` state, since the user closing the dialog (or
  // selecting a different layer) before the transaction mines would
  // otherwise leave the effect's closure looking at a null/different layer
  // when confirmation finally arrives — silently dropping the art update in
  // exactly the "submit and move on" case users are likely to hit.
  const pendingUpdateRef = useRef<{
    tokenId: string;
    values: Record<string, number>;
  } | null>(null);

  const [chainControls, setChainControls] = useState<ReturnType<
    typeof readControlValues
  > | null>(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [verifiedIdentity, setVerifiedIdentity] = useState('');
  const identity = `${contractAddress}:${layer?.tokenId}:${address}`;
  const canUpdate =
    isOwner &&
    verifiedIdentity === identity &&
    !!chainControls &&
    chainId === ACTIVE_NETWORK;

  // Read current values when opening a layer; mint-time defaults may be years old.
  useEffect(() => {
    let cancelled = false;
    setChainControls(null);
    setControlsError(null);
    if (!isOpen || !layer || !contractAddress) return;
    setControlsLoading(true);
    const contract = getContract({
      address: contractAddress,
      abi: getAbiForAddress(contractAddress),
      client: publicClient,
    });
    contract.read
      .getControlToken([BigInt(layer.tokenId)])
      .then((raw) => {
        if (cancelled) return;
        const current = readControlValues(raw, layer.controls.length);
        setChainControls(current);
        setLocalValues(
          initialControlValues(
            layer.tokenId,
            layer.controls,
            currentValues,
            current,
          ),
        );
      })
      .catch(() => {
        if (!cancelled)
          setControlsError(
            'Could not read current layer settings. Reopen to retry. Saving is unavailable until they load.',
          );
      })
      .finally(() => {
        if (!cancelled) setControlsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, layer, contractAddress, currentValues]);

  // Clear stale ownership on wallet/layer changes and ignore late responses.
  useEffect(() => {
    let cancelled = false;
    setIsOwner(false);
    setVerifiedIdentity('');
    setOwnerCheckFailed(false);
    if (!isOpen || !address || !layer || !contractAddress) return;
    const contract = getContract({
      address: contractAddress,
      abi: getAbiForAddress(contractAddress),
      client: publicClient,
    });
    contract.read
      .ownerOf([BigInt(layer.tokenId)])
      .then((owner) => {
        if (cancelled) return;
        setIsOwner(ownsControl(address, owner));
        setVerifiedIdentity(identity);
      })
      .catch(() => {
        if (!cancelled) setOwnerCheckFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, address, layer, contractAddress, identity]);

  // Once the on-chain write is actually confirmed (not just submitted to the
  // mempool), apply the same values the user just wrote on-chain to the
  // client-side preview overrides, so the composited art updates immediately
  // instead of requiring a full page reload to pick up the new chain state.
  useEffect(() => {
    if (isConfirmed && pendingUpdateRef.current) {
      onPreview(
        pendingUpdateRef.current.tokenId,
        pendingUpdateRef.current.values,
      );
      pendingUpdateRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  useEffect(() => {
    if (layer?.controls) {
      setLocalValues(
        initialControlValues(layer.tokenId, layer.controls, currentValues),
      );
    }
  }, [layer, currentValues]);

  const handleChange = (index: number, value: number) => {
    const newValues = { ...localValues, [index]: value };
    setLocalValues(newValues);
  };

  const handlePreview = () => {
    // Send preview update
    const previewValues: Record<string, number> = {};
    Object.keys(localValues).forEach((k) => {
      // @ts-ignore
      previewValues[`${layer.tokenId}-${k}`] = localValues[k];
    });
    onPreview(layer.tokenId, previewValues);
    onClose();
  };

  const handleUpdateChain = () => {
    if (
      !writeContract ||
      !layer ||
      !contractAddress ||
      !canUpdate ||
      !chainControls ||
      controlsLoading
    )
      return;

    resetWrite();
    const { leverIds, values: newValues } = changedControlValues(
      localValues,
      chainControls,
    );
    if (!leverIds.length) return;

    const confirmedValues: Record<string, number> = {};
    leverIds.map(String).forEach((k) => {
      confirmedValues[`${layer.tokenId}-${k}`] = localValues[k];
    });
    pendingUpdateRef.current = {
      tokenId: layer.tokenId,
      values: confirmedValues,
    };

    writeContract({
      address: contractAddress,
      abi: getAbiForAddress(contractAddress),
      chainId: ACTIVE_NETWORK,
      functionName: 'useControlToken',
      args: [BigInt(layer.tokenId), leverIds, newValues],
    });
  };

  const updateChainLabel = isPending
    ? 'Confirm in wallet...'
    : isConfirming
      ? 'Waiting for confirmation...'
      : 'Update on Chain';

  if (!isOpen || !layer) return null;

  return (
    <Modal title={layer.name} onClose={onClose}>
      <div className="p-4 space-y-6 max-h-[75dvh] overflow-y-auto">
        <p className="text-sm text-text-muted">
          Preview changes locally. The layer owner can save changes on-chain to
          update the master for everyone.{' '}
          {isMusic &&
            'Music previews update the linked artwork too; press Play to hear the new mix.'}
        </p>
        {controlsLoading && (
          <p role="status" className="text-sm">
            Reading current layer settings…
          </p>
        )}
        {controlsError && (
          <p role="alert" className="text-sm text-danger">
            {controlsError}
          </p>
        )}
        <div className="space-y-4">
          {layer.controls?.map((control: Control, index: number) => {
            const value = localValues[index];
            const previews =
              control.controlType === 'STATE'
                ? getLayerStatePreviews(
                    metadataLayers,
                    masterTokenId,
                    Number(layer.tokenId),
                    index,
                    control.label,
                    isMusic,
                  )
                : [];
            // One real layer-controls.json entry has a typo'd key
            // ("maxVaue") instead of "maxValue" on a BLUE control - fall
            // back to a sane default (255, this collection's common max)
            // rather than rendering that one slider with an undefined max.
            const maxValue =
              chainControls?.[index]?.max ?? control.maxValue ?? 255;
            const minValue = chainControls?.[index]?.min ?? control.minValue;
            const fillPercent =
              control.controlType === 'STATE'
                ? 0
                : ((value - minValue) / (maxValue - minValue || 1)) * 100;

            return (
              <div key={index} className="space-y-2">
                <label className="block text-sm font-medium text-text-muted">
                  {isMusic
                    ? 'Variant'
                    : control.label.replace(/ \(STATE\)$/, '')}
                </label>

                {control.controlType === 'STATE' && control.stateLabels ? (
                  <select
                    aria-label={
                      isMusic
                        ? 'Variant'
                        : control.label.replace(/ \(STATE\)$/, '')
                    }
                    disabled={controlsLoading || isPending || isConfirming}
                    value={value ?? minValue}
                    onChange={(e) =>
                      handleChange(index, parseInt(e.target.value))
                    }
                    className="w-full mt-1 pl-3 pr-10 py-2 text-base border border-border rounded bg-surface-sunken text-text focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  >
                    {control.stateLabels.map((label, i) => (
                      <option key={i} value={minValue + i}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min={minValue}
                      max={maxValue}
                      disabled={controlsLoading || isPending || isConfirming}
                      value={value ?? minValue}
                      onChange={(e) =>
                        handleChange(index, parseInt(e.target.value))
                      }
                      style={{
                        background: `linear-gradient(to right, rgb(var(--accent)) ${fillPercent}%, rgb(var(--surface-sunken)) ${fillPercent}%)`,
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <span className="text-xs font-medium text-text bg-surface-sunken rounded-full px-2 py-0.5 min-w-[2.5rem] text-center">
                      {value}
                    </span>
                  </div>
                )}
                {control.controlType === 'STATE' &&
                  control.stateLabels &&
                  previews.some(Boolean) && (
                    <div
                      role="group"
                      aria-label={`${isMusic ? 'Variant' : control.label} previews`}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2"
                    >
                      {control.stateLabels.map((label, i) => {
                        const optionValue = Number(minValue) + i;
                        const selected = (value ?? minValue) === optionValue;
                        return (
                          <button
                            key={optionValue}
                            type="button"
                            aria-label={`Select ${label}`}
                            aria-pressed={selected}
                            disabled={
                              controlsLoading || isPending || isConfirming
                            }
                            onClick={() => handleChange(index, optionValue)}
                            className={`min-w-0 overflow-hidden rounded-lg border-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 ${selected ? 'border-accent bg-surface-raised' : 'border-border'}`}
                          >
                            <div className="aspect-square w-full">
                              <LayerThumbnail
                                imageUrl={previews[optionValue] || ''}
                                name={`${label} artwork`}
                              />
                            </div>
                            <span className="block px-2 py-2 text-sm break-words">
                              {label}
                              {selected && <span aria-hidden="true"> ✓</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border">
          {contractAddress && (
            <button
              onClick={() => openLayer(contractAddress, String(layer.tokenId))}
              className="btn-ghost"
            >
              View Details
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button
            onClick={handlePreview}
            disabled={controlsLoading || isPending || isConfirming}
            className="btn-secondary"
          >
            Preview
          </button>
          {isOwner && verifiedIdentity === identity ? (
            <button
              onClick={handleUpdateChain}
              disabled={
                !canUpdate ||
                controlsLoading ||
                isPending ||
                isConfirming ||
                !chainControls ||
                !Object.entries(localValues).some(
                  ([k, v]) => v !== chainControls[Number(k)]?.value,
                )
              }
              className="btn-primary"
            >
              {chainId !== ACTIVE_NETWORK
                ? 'Switch wallet to Ethereum'
                : updateChainLabel}
            </button>
          ) : (
            <div className="w-full text-xs text-text-muted">
              {ownerCheckFailed
                ? "Couldn't verify ownership — check your connection and reopen this dialog to retry."
                : 'Only owner can update on-chain'}
              {!contractAddress && ' (Contract not resolved)'}
            </div>
          )}
        </div>
        {isConfirmed && (
          <p className="text-success text-sm mt-2">
            Change confirmed on-chain — the art has been updated.
          </p>
        )}
        {isSubmitted && !isConfirmed && !isConfirmError && (
          <p className="text-text-muted text-sm mt-2">
            Transaction submitted, waiting for it to be mined...
          </p>
        )}
        {(isSubmitError || isConfirmError) && (
          <p className="text-danger text-sm mt-2">
            {isSubmitError
              ? submitError?.message?.split('\n')[0] ||
                'Transaction failed to submit.'
              : 'Transaction was mined but reverted — the change was not applied.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
