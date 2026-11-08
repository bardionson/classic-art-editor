// Reviewed archive presentation choices; original metadata and direct pages remain intact.
// Right Place & Right Time #115 is held by TokenUpgrader. Hide this earlier
// configuration at the archive owner's request; retain #245 in discovery.
const hiddenMasters = new Set([
  '0x6c424c25e9f1fff9642cb5b7750b0db7312c29ad:115',
  '0xb6dae651468e9593e4581705a09c10a76ac1e0c8:115',
]);

export function isArchiveVisible(record: {
  contractAddress: string;
  tokenId: string;
}): boolean {
  return !hiddenMasters.has(
    `${record.contractAddress.toLowerCase()}:${record.tokenId}`,
  );
}
