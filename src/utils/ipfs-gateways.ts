// Shared retrieval order. Preserved local/R2 copies may precede these gateways.
export const IPFS_GATEWAYS = [
  { name: 'Filebase IPFS', url: 'https://ipfs.filebase.io' },
  { name: 'Alchemy IPFS', url: 'https://alchemy.mypinata.cloud' },
  { name: 'Pinata', url: 'https://gateway.pinata.cloud' },
  { name: 'IPFS.io', url: 'https://ipfs.io' },
];
export const IPFS_PATH_GATEWAYS = IPFS_GATEWAYS.map(
  ({ url }) => `${url}/ipfs/`,
);
