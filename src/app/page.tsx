'use client';

import logo from '../../public/logo/async-logo.svg';
import firstSupperHero from '../../public/first-supper-0.jpg';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import FAQ from '@/components/faq';
import Gallery from '@/components/gallery/Gallery';
import WalletProvider from '@/app/wallet-provider';
import Image from 'next/image';
import Link from 'next/link';
import { getMastersGalleryItems } from '@/utils/masters';

export default function Home() {
  const mastersItems = getMastersGalleryItems();
  const featured = mastersItems.find((item) => item.tokenId === '0'); // "First Supper"

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
        {featured && (
          <section className="mb-12">
            <Link href={featured.link} className="group block">
              <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-lg shadow-soft-drop bg-alabaster">
                <Image
                  src={firstSupperHero}
                  alt={featured.name}
                  fill
                  sizes="100vw"
                  priority
                  className="object-cover group-hover:scale-[102%] transition"
                />
              </div>
              <h2 className="text-2xl font-bold mt-4 group-hover:text-purple transition">
                {featured.name}
              </h2>
            </Link>
          </section>
        )}
        <section>
          <p>
            <span>
              What a ride it’s been. The Digital Rescue Lab is bringing Async
              Art back to life.
            </span>
            <br />
            <br />
            <span>
              To help with restoration take a look at our pages soon on Juicebox
              and{' '}
              <a
                target="_blank"
                rel="noreferrer noopener"
                href="https://x.com/ArtRescueLab"
                className="underline"
              >
                X Art Rescue Lab
              </a>
            </span>
            <br />
            <br />
            <span>
              Thank you from all of us at Digital Rescue Lab ❤️ and thank you to
              Async Art for the redirect of www.async.art
            </span>
          </p>
        </section>
        <section className="mt-12">
          <Gallery title="Masters Gallery" items={mastersItems} embedded />
        </section>
        <section className="mt-12">
          <p className="text-grey">
            Async Art let artists build &quot;layered&quot; NFTs — a Master
            artwork made of individually-owned Layers that anyone holding a
            Layer could change, shifting a color, a shape, even a shadow, and
            watch the Master update in real time. When Async Art&apos;s own
            infrastructure went dark, all of that stopped working: the art was
            still on-chain, but nobody could view it composited or control the
            layers they owned. This project is our attempt to bring that back
            using the original, open-sourced Async Art code, rebuilt to run
            independently so the art and the ability to control it don&apos;t
            depend on any one company staying online.
          </p>
          <a href="#faq" className="underline text-purple mt-2 inline-block">
            Read More
          </a>
        </section>
        <section className="mt-12">
          <Link
            href="/gallery/layers"
            className="btn btn-black inline-block px-6"
          >
            Browse Layers Gallery
          </Link>
        </section>
        <section className="mt-12" id="faq">
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
        <section className="mt-12">
          <p>
            <span>
              Using the legacy Async Code we have restored the ability to again
              control the classic Async Art. By searching for art in the gallery
              you can view it and every layer it contains. Now you can change
              the layers in a preview draft mode even if you do not own the
              layer. Be aware that color changes are not working properly yet,
              Async Music pieces will not play music and pieces where the layers
              are missing from IPFS will not be able to be controlled. We are
              constantly working on additional steps to restore the art.
            </span>
            <br />
            <br />
            <span>
              In this app you no longer need to search for the id of your art as
              there is a gallery view.
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}
