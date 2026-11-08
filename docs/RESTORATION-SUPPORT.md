# Restoration support links

Verified 2026-11-08 on https://digitalrescuelab.xyz/ and /overview.

The official site lists `digitalrescuelab.eth` under “DONATE” and says “new campaign coming soon”. Its donation href is `#`, not a working campaign destination. The overview says funds route through a multisig, but provides no new campaign URL.

Async now prominently links to Digital Rescue Lab from the homepage, and its Support navigation leads to the homepage support section. The former Juicebox URL was removed from the application because the official site does not currently endorse that campaign. This does not establish that the old campaign is closed. No replacement payment address, network, or campaign URL has been inferred.

When the Lab publishes its new campaign, verify that destination against the official site and update the support section and navigation together.

## Site-wide donation banner

At the user's request, all page headers display the ENS name and its Ethereum receiving address with copy buttons. On 2026-11-08, forward ENS resolution independently returned `0x493efda67372a17A1F487B0Dd5F0E3C0C9284daB` using `https://ethereum-rpc.publicnode.com` and `https://eth.drpc.org`. Both returned deployed contract code at that address. This is the ENS receiving address, not the ENS registrant/owner. No payment transaction is initiated by the banner.

The shared header measures its height so artwork and controls stay below the banner, including mobile and mirror display pages. No per-visitor ENS calls are added.
