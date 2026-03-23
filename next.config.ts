import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  // Next.js 16+ 请求体大小限制配置
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // 这是 Next.js 16 新增的配置项，用于 API Routes
    proxyClientMaxBodySize: '50mb',
  },
};

export default nextConfig;
