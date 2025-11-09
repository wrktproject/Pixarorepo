# Pixaro Deployment Guide

This guide covers deploying Pixaro to various static hosting platforms.

## Prerequisites

Before deploying, ensure:
- All tests pass: `npm run test`
- Build succeeds: `npm run build`
- No linting errors: `npm run lint`

## Platform-Specific Deployment

### Vercel (Recommended)

Vercel offers zero-configuration deployment with automatic HTTPS and global CDN.

#### Deploy via CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to link your project

4. For production deployment:
```bash
vercel --prod
```

#### Deploy via Git Integration

1. Push your code to GitHub, GitLab, or Bitbucket
2. Visit [vercel.com](https://vercel.com) and sign in
3. Click "New Project"
4. Import your repository
5. Vercel will auto-detect Vite and use the correct settings
6. Click "Deploy"

**Configuration**: The `vercel.json` file in the root directory contains:
- SPA routing configuration
- Cache headers for optimal performance
- Security headers

### Netlify

Netlify provides continuous deployment with built-in CDN and form handling.

#### Deploy via CLI

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Build your project:
```bash
npm run build
```

3. Deploy:
```bash
netlify deploy
```

4. For production:
```bash
netlify deploy --prod
```

#### Deploy via Git Integration

1. Push your code to GitHub, GitLab, or Bitbucket
2. Visit [netlify.com](https://netlify.com) and sign in
3. Click "Add new site" → "Import an existing project"
4. Connect your repository
5. Netlify will auto-detect the build settings
6. Click "Deploy site"

**Configuration**: The `netlify.toml` file contains:
- Build command and output directory
- SPA routing redirects
- Cache control headers
- Security headers
- Asset optimization settings

### Cloudflare Pages

Cloudflare Pages offers global edge network deployment with excellent performance.

#### Deploy via Wrangler CLI

1. Install Wrangler:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Build your project:
```bash
npm run build
```

4. Deploy:
```bash
wrangler pages deploy dist
```

#### Deploy via Git Integration

1. Push your code to GitHub or GitLab
2. Visit [dash.cloudflare.com](https://dash.cloudflare.com)
3. Go to "Workers & Pages" → "Create application" → "Pages"
4. Connect your repository
5. Configure build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
6. Click "Save and Deploy"

**Configuration**: The `_headers` and `_redirects` files contain:
- Cache control for static assets
- Security headers
- SPA routing configuration

### GitHub Pages

GitHub Pages is free for public repositories.

#### Setup

1. Install gh-pages package:
```bash
npm install --save-dev gh-pages
```

2. Add deployment script to `package.json`:
```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

3. Update `vite.config.ts` with your repository name:
```typescript
export default defineConfig({
  base: '/your-repo-name/', // Replace with your repo name
  // ... rest of config
})
```

4. Deploy:
```bash
npm run deploy
```

5. Enable GitHub Pages in repository settings:
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` → `/root`
   - Save

**Note**: GitHub Pages doesn't support custom headers, so some optimizations won't apply.

## Environment Variables

### Required for Ad Integration

If you're using Google AdSense, create a `.env` file (not committed to git):

```env
VITE_ADSENSE_PUBLISHER_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_AD_SIDEBAR_SLOT=1234567890
VITE_AD_BOTTOM_SLOT=0987654321
```

### Platform-Specific Environment Variables

#### Vercel
Add environment variables in the Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add each variable with its value
3. Redeploy for changes to take effect

#### Netlify
Add environment variables in the Netlify dashboard:
1. Go to Site Settings → Environment Variables
2. Add each variable with its value
3. Redeploy for changes to take effect

#### Cloudflare Pages
Add environment variables in the Cloudflare dashboard:
1. Go to Workers & Pages → Your Project → Settings → Environment Variables
2. Add each variable with its value
3. Redeploy for changes to take effect

## Post-Deployment Checklist

After deploying, verify:

- [ ] Application loads correctly
- [ ] All routes work (test navigation)
- [ ] Image upload and processing works
- [ ] WebGL rendering functions properly
- [ ] AI removal tool loads and works
- [ ] Presets can be saved and loaded
- [ ] Export functionality works
- [ ] Undo/redo works correctly
- [ ] Ads display correctly (if enabled)
- [ ] HTTPS is enabled
- [ ] Custom domain is configured (if applicable)

## Performance Optimization

### CDN Configuration

All recommended platforms include CDN by default. Ensure:
- Static assets are cached with long TTL (configured in headers)
- Gzip/Brotli compression is enabled (configured in build)
- HTTP/2 or HTTP/3 is enabled (automatic on most platforms)

### Monitoring

Consider adding:

1. **Google Analytics** (optional):
   - Add `VITE_GA_MEASUREMENT_ID` environment variable
   - Implement tracking in your app

2. **Error Tracking** (optional):
   - Sentry, LogRocket, or similar
   - Track client-side errors

3. **Performance Monitoring**:
   - Use Lighthouse CI for automated performance checks
   - Monitor Core Web Vitals

## Custom Domain Setup

### Vercel
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as instructed
4. Wait for SSL certificate provisioning

### Netlify
1. Go to Site Settings → Domain Management
2. Add custom domain
3. Configure DNS records
4. SSL certificate is automatic

### Cloudflare Pages
1. Go to Custom Domains
2. Add your domain
3. If domain is on Cloudflare, it's automatic
4. Otherwise, configure DNS records

## Rollback Procedure

### Vercel
1. Go to Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

### Netlify
1. Go to Deploys
2. Find the previous working deployment
3. Click "Publish deploy"

### Cloudflare Pages
1. Go to Deployments
2. Find the previous working deployment
3. Click "Rollback to this deployment"

## Troubleshooting

### Build Fails

1. Check build logs for errors
2. Verify Node.js version (18+ required)
3. Clear cache and rebuild:
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

### Routes Don't Work (404 errors)

- Ensure SPA routing is configured (redirects to index.html)
- Check platform-specific configuration files

### Assets Not Loading

- Verify `base` path in `vite.config.ts`
- Check browser console for CORS errors
- Verify asset paths in build output

### WebGL Not Working

- Check browser compatibility
- Verify WebGL is enabled in browser
- Check for Content Security Policy issues

### Slow Performance

- Verify compression is enabled (check response headers)
- Check bundle size: `npm run build:analyze`
- Ensure CDN is serving assets
- Check for large unoptimized images

## Security Considerations

### Content Security Policy

The default CSP allows:
- Scripts from self and Google AdSense
- Styles from self (with inline styles)
- Images from any HTTPS source
- Fonts from self

Adjust CSP in deployment configuration files if you add new third-party services.

### HTTPS

All recommended platforms provide automatic HTTPS. Never deploy without HTTPS as:
- WebGL may be restricted on HTTP
- Modern browser features require secure context
- User privacy and security

### API Keys

- Never commit API keys to git
- Use environment variables for all secrets
- Rotate keys if accidentally exposed

## Continuous Deployment

### Automatic Deployments

All platforms support automatic deployment on git push:

1. Connect your repository
2. Configure branch for production (usually `main` or `master`)
3. Optionally configure preview deployments for PRs

### Build Optimization

To speed up builds:
- Use npm ci instead of npm install (faster, more reliable)
- Enable build caching (automatic on most platforms)
- Consider using pnpm or yarn for faster installs

## Cost Considerations

### Free Tiers

- **Vercel**: 100GB bandwidth/month, unlimited sites
- **Netlify**: 100GB bandwidth/month, 300 build minutes/month
- **Cloudflare Pages**: Unlimited bandwidth, 500 builds/month
- **GitHub Pages**: 100GB bandwidth/month, 10 builds/hour

### Scaling

For high traffic:
- Cloudflare Pages offers best free tier for bandwidth
- Vercel and Netlify have generous paid tiers
- Consider CDN costs for large assets

## Support

For deployment issues:
- Check platform-specific documentation
- Review build logs carefully
- Test locally first: `npm run build && npm run preview`
- Open an issue on GitHub with deployment logs

---

**Last Updated**: November 2025
