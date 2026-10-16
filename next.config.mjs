/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Block MIME-type sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak the full URL to other origins.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // No framing (clickjacking protection).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Camera/microphone must stay available to same-origin pages:
          // the Speaking recorder (getUserMedia) needs them. Other
          // powerful features are denied.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
          },
          // NOTE: no Content-Security-Policy here on purpose — CSP needs
          // testing against the inline theme script, GSAP/DarkVeil and
          // third-party audio before it can ship without breaking pages.
        ],
      },
    ];
  },
};

export default nextConfig;
