'use client';

import logo from '../../public/logo/async-logo.svg';
import viewMasterArtIcon from '../../public/icons/solid-badged.svg';
import updateLayerArtIcon from '../../public/icons/scrollreveal.svg';
import MasterArtViewer from '@/components/master-art-viewer/master-art-viewer';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ToolBox from '@/components/tool-box';
import { useEffect, useState } from 'react';
import LayerArtChanger from '@/components/layer-art-updater/layer-art-changer';
import FAQ from '@/components/faq';
import { useRouter, useSearchParams } from 'next/navigation';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import { Address } from 'viem';
import WalletProvider from '@/app/wallet-provider';
import Image from 'next/image';

enum MODAL {
  NONE,
  VIEW_MASTER_ARTWORK,
  UPDATE_LAYER_ARTWORK,
}

export default function Home() {
  const [modal, setModal] = useState(MODAL.NONE);
  const searchParams = useSearchParams();
  const router = useRouter();
  const version = searchParams.get('version');
  const id = searchParams.get('id');
  const tokenId = id ? Number(id) : undefined;
  const tokenAddress =
    version === 'v1'
      ? V1_CONTRACT_ADDRESS
      : version === 'v2'
      ? V2_CONTRACT_ADDRESS
      : undefined;

  useEffect(() => {
    if (version && id) {
      setModal(MODAL.VIEW_MASTER_ARTWORK);
    }
  }, [version, id]);

  return (
    <div className="flex min-h-screen flex-col items-center">
      <header className="container pt-8 mb-12 px-4">
        <nav className="flex items-center justify-between">
          <Image
            src={logo.src}
            width={logo.width}
            height={logo.height}
            alt="Async Art Logo"
            className="w-24"
          />
          <h1 className="hidden sm:block text-2xl font-bold ml-3">
            Classic Art Editor Revival Version 2 by Bård Ionson
          </h1>
          <WalletProvider>
            <ConnectButton accountStatus="address" showBalance={false} />
          </WalletProvider>
        </nav>
      </header>
      <main className="container px-4">
        <section>
          <p>
            <span>
              What a ride it’s been. The Digital Rescue Lab is bringing Async Art back to life. Using the legacy Async Code we have
              restored the ability to again control the classic Async Art. Be aware that color changes are not working properly yet, Async Music
              pieces will not play music and pieces where the layers are missing from IPFS will not be able to be controlled.
              We are constantly working on additional steps to restore the art.
            </span>
            <br />
            <br />
            <span>
              In this app you no longer need to search for the id of your art as there is a gallery view.
            </span>
            <br />
            <br />
            <span>
              To help with restoration take a look at our pages on <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://artizen.fund/index/p/digital-rescue-lab?season=6&scroll=no"
              className="underline"
            >Artizen</a> and <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://github.com/bardionson/classic-art-editor"
              className="underline"
            >Juicebox</a>
              
            </span>
            <br />
            <br />
            <span>Thank you again from all of us at Digital Rescue Lab ❤️</span>
            <br />
            <br />
            <span>New Repository: </span>
            <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://github.com/bardionson/classic-art-editor"
              className="underline"
            >
              https://github.com/bardionson/classic-art-editor
            </a>
            <span>Old Repository: </span>
            <a
              target="_blank"
              rel="noreferrer noopener"
              href="https://github.com/asyncart/classic-art-editor"
              className="underline"
            >
              https://github.com/asyncart/classic-art-editor
            </a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-12">
            <ToolBox
              icon={viewMasterArtIcon}
              title="Masters Gallery"
              description="Browse and search all Master Artworks."
              onClick={() => router.push('/gallery/masters')}
            />
            <ToolBox
              icon={updateLayerArtIcon}
              title="Layers Gallery"
              description="Browse and search all Layer Artworks."
              onClick={() => router.push('/gallery/layers')}
            />
            <ToolBox
              icon={viewMasterArtIcon}
              title="View Master Artwork"
              description="View the current state for any Async Art Master token."
              onClick={() => setModal(MODAL.VIEW_MASTER_ARTWORK)}
            />
            <ToolBox
              icon={updateLayerArtIcon}
              title="Update Layer"
              description="Update the values for a Layer token that you own."
              onClick={() => setModal(MODAL.UPDATE_LAYER_ARTWORK)}
            />
          </div>
        </section>
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-2.5">FAQs</h2>
          
          <FAQ
            title="How Can I Locate and Repin Content to IPFS?"
            className="mt-4"
          >
            <p className="pl-3 p-2">
              See our article on this{' '}
              <a
                href="https://medium.com/@AsyncArt/how-to-locate-and-repin-nft-content-ea09e4bd0eaf"
                target="_blank"
                rel="noreferrer noopener"
                className="text-purple underline"
              >
                here
              </a>
              .
            </p>
          </FAQ>
        </section>
      </main>
      {modal === MODAL.VIEW_MASTER_ARTWORK && (
        <MasterArtViewer
          onClose={() => setModal(MODAL.NONE)}
          tokenAddress={tokenAddress as Address}
          tokenId={tokenId}
        />
      )}
      {modal === MODAL.UPDATE_LAYER_ARTWORK && (
        <WalletProvider>
          <LayerArtChanger onClose={() => setModal(MODAL.NONE)} />
        </WalletProvider>
      )}
    </div>
  );
}
