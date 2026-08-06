/** @type {import('next').NextConfig} */
const nextConfig = {
  // ffmpeg.wasm's single-threaded core (used by this scaffold) does not need
  // COOP/COEP headers. If you upgrade to the multi-threaded core later
  // (@ffmpeg/core-mt) for faster rendering, add SharedArrayBuffer-enabling
  // headers here:
  //
  // async headers() {
  //   return [
  //     {
  //       source: "/(.*)",
  //       headers: [
  //         { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  //         { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;
