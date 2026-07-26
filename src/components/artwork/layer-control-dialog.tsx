import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/common/modal';
import { Address, getContract } from 'viem';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { publicClient } from '@/utils/rpcClient';
import { getAbiForAddress } from '@/utils/contract-helpers';

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
};

export default function LayerControlDialog({
  layer,
  isOpen,
  onClose,
  onPreview,
  currentValues,
  contractAddress,
}: LayerControlDialogProps) {
  const { address } = useAccount();
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

  // Check ownership
  useEffect(() => {
    async function checkOwnership() {
      if (!address || !layer?.tokenId || !contractAddress) return;
      setOwnerCheckFailed(false);
      try {
        const contract = getContract({
          address: contractAddress,
          abi: getAbiForAddress(contractAddress),
          client: publicClient,
        });

        const owner = await contract.read.ownerOf([BigInt(layer.tokenId)]);
        // @ts-ignore
        setIsOwner(owner === address);
      } catch (e) {
        console.error('Error checking ownership', e);
        setIsOwner(false);
        setOwnerCheckFailed(true);
      }
    }
    checkOwnership();
  }, [address, layer, contractAddress]);

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
      const defaults: Record<number, number> = {};
      layer.controls.forEach((c: any, i: number) => {
        const key = `${layer.tokenId}-${i}`;
        defaults[i] =
          currentValues[key] !== undefined
            ? currentValues[key]
            : c.startValue || c.minValue;
      });
      setLocalValues(defaults);
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
    if (!writeContract || !layer?.tokenId || !contractAddress) return;

    resetWrite();
    const leverIds = Object.keys(localValues).map((k) => BigInt(k));
    const newValues = Object.values(localValues).map((v) => BigInt(v));

    const confirmedValues: Record<string, number> = {};
    Object.keys(localValues).forEach((k) => {
      // @ts-ignore
      confirmedValues[`${layer.tokenId}-${k}`] = localValues[k];
    });
    pendingUpdateRef.current = {
      tokenId: layer.tokenId,
      values: confirmedValues,
    };

    writeContract({
      address: contractAddress,
      abi: getAbiForAddress(contractAddress),
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
      <div className="p-4 space-y-6">
        <div className="space-y-4">
          {layer.controls?.map((control: Control, index: number) => {
            const value = localValues[index];
            // One real layer-controls.json entry has a typo'd key
            // ("maxVaue") instead of "maxValue" on a BLUE control - fall
            // back to a sane default (255, this collection's common max)
            // rather than rendering that one slider with an undefined max.
            const maxValue = control.maxValue ?? 255;
            const fillPercent =
              control.controlType === 'STATE'
                ? 0
                : ((value - control.minValue) /
                    (maxValue - control.minValue || 1)) *
                  100;

            return (
              <div key={index} className="space-y-2">
                <label className="block text-sm font-medium text-text-muted">
                  {control.label}
                </label>

                {control.controlType === 'STATE' && control.stateLabels ? (
                  <select
                    value={value}
                    onChange={(e) =>
                      handleChange(index, parseInt(e.target.value))
                    }
                    className="mt-1 pl-3 pr-10 py-2 text-base border-border focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  >
                    {control.stateLabels.map((label, i) => (
                      <option key={i} value={i}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min={control.minValue}
                      max={maxValue}
                      value={value}
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
              </div>
            );
          })}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
          <button onClick={handlePreview} className="btn-secondary">
            Preview
          </button>
          {isOwner ? (
            <button
              onClick={handleUpdateChain}
              disabled={isPending || isConfirming}
              className="btn-primary"
            >
              {updateChainLabel}
            </button>
          ) : (
            <div className="text-xs text-text-muted flex items-center">
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
