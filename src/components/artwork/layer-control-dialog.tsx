import { useState, useEffect } from 'react';
import { Modal } from '@/components/common/modal';
import { getContract } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { publicClient } from '@/utils/rpcClient';
import { getContractInfo } from '@/utils/contract-helpers';

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
};

export default function LayerControlDialog({
  layer,
  isOpen,
  onClose,
  onPreview,
  currentValues,
}: LayerControlDialogProps) {
  const { address } = useAccount();
  const { writeContract, isPending, isSuccess } = useWriteContract();
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [isOwner, setIsOwner] = useState(false);

  // Check ownership
  useEffect(() => {
    async function checkOwnership() {
      if (!address || !layer?.tokenId) return;

      const { address: contractAddress, abi } = getContractInfo(Number(layer.tokenId));
      if (!contractAddress) return;

      try {
        const contract = getContract({
          address: contractAddress,
          abi,
          client: publicClient,
        });
        // Try ownerOf
        try {
            const owner = await contract.read.ownerOf([BigInt(layer.tokenId)]);
            if (owner === address) {
                setIsOwner(true);
                return;
            }
        } catch (e) {}
      } catch (e) {
        console.error('Error checking ownership', e);
      }
    }
    checkOwnership();
  }, [address, layer]);

  useEffect(() => {
      if (layer?.controls) {
          const defaults: Record<number, number> = {};
          layer.controls.forEach((c: any, i: number) => {
             const key = `${layer.tokenId}-${i}`;
             defaults[i] = currentValues[key] !== undefined ? currentValues[key] : (c.startValue || c.minValue);
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
    if (!writeContract || !layer?.tokenId) return;

    const { address: contractAddress, abi } = getContractInfo(Number(layer.tokenId));
    if (!contractAddress) return;

    const leverIds = Object.keys(localValues).map(k => BigInt(k));
    const newValues = Object.values(localValues).map(v => BigInt(v));

    writeContract({
        address: contractAddress,
        abi,
        functionName: 'useControlToken',
        args: [BigInt(layer.tokenId), leverIds, newValues],
    });
  };

  if (!isOpen || !layer) return null;

  return (
    <Modal title={layer.name} onClose={onClose}>
      <div className="p-4 space-y-6">
        <div className="space-y-4">
          {layer.controls?.map((control: Control, index: number) => (
            <div key={index} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {control.label}
              </label>

              {control.controlType === 'STATE' && control.stateLabels ? (
                <select
                  value={localValues[index]}
                  onChange={(e) => handleChange(index, parseInt(e.target.value))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
                    max={control.maxValue}
                    value={localValues[index]}
                    onChange={(e) => handleChange(index, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-500 w-12 text-right">
                    {localValues[index]}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={handlePreview}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Preview
          </button>
          {isOwner ? (
            <button
              onClick={handleUpdateChain}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Updating...' : 'Update on Chain'}
            </button>
          ) : (
            <div className="text-xs text-gray-500 flex items-center">
              Only owner can update on-chain
            </div>
          )}
        </div>
        {isSuccess && (
            <p className="text-green-600 text-sm mt-2">Transaction submitted successfully!</p>
        )}
      </div>
    </Modal>
  );
}
