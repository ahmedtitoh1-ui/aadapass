import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || 'https://aadapass.sa';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/stores', '/stores/*', '/privacy', '/terms', '/contact'],
        disallow: ['/api/', '/admin'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
