# shadcn React Setup Notes

This ADK website is currently a static HTML/CSS/JavaScript site. It does not yet have a React framework, Tailwind CSS build pipeline, TypeScript configuration, or `components.json` for shadcn/ui.

The requested React files have been placed in the conventional shadcn path:

- Components: `/components/ui`
- Shared utilities: `/lib/utils.ts`
- Demo entry: `/components/header-demo.tsx`
- Additional demo entry: `/components/navbar1-demo.tsx`
- Feature spotlight demo entry: `/components/feature-spotlight-demo.tsx`
- Expandable hero button demo entry: `/components/hero-button-demo.tsx`
- Footer demo entry: `/components/footer-7-demo.tsx`
- Spatial product showcase demo entry: `/components/spatial-product-showcase-demo.tsx`

Creating `/components/ui` matters because shadcn components and the provided imports use the `@/components/ui/...` alias. Keeping that convention makes copied components portable across shadcn examples and avoids rewriting imports later.

The current static site stylesheet is `/styles.css`. In a shadcn React app, the global Tailwind stylesheet would usually be:

- Next.js App Router: `/app/globals.css`
- Vite React: `/src/index.css` or `/src/globals.css`

## Current Status

- shadcn project structure: not configured yet
- Tailwind CSS: not configured yet
- TypeScript: validation-only config is available at `/tsconfig.shadcn.json`
- Current production page: still served from `/index.html`
- `tsconfig.shadcn.json`: added only to validate the copied React component files during migration
- Added UI primitives: `accordion`, `button`, `input`, `label`, `navigation-menu`, and `sheet`
- Added block component: `shadcnblocks-com-navbar1`
- Added feature component: `feature-spotlight`
- Added interactive component: `hero-button-expendable`
- Added footer component: `footer-7`
- Added product showcase component: `spatial-product-showcase`
- Added animation/shader dependencies for future React use: `framer-motion` and `@paper-design/shaders-react`
- Added icon dependency for footer/social components: `react-icons`
- The live static site uses `/styles.css`; the provided Tailwind theme snippet should be applied later to the actual Tailwind global stylesheet after the project is migrated.

## Recommended Setup

For a new Vite React app:

```bash
npm create vite@latest adk-react -- --template react-ts
cd adk-react
npm install
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init -t vite
npx shadcn@latest add accordion button input label navigation-menu sheet
npm install lucide-react react-icons framer-motion @paper-design/shaders-react @radix-ui/react-accordion @radix-ui/react-slot class-variance-authority @radix-ui/react-icons @radix-ui/react-navigation-menu @radix-ui/react-dialog @radix-ui/react-label clsx tailwind-merge
```

For a new Next.js app:

```bash
npx create-next-app@latest adk-react --typescript --tailwind --eslint --app --import-alias "@/*"
cd adk-react
npx shadcn@latest init -t next
npx shadcn@latest add accordion button input label navigation-menu sheet
npm install lucide-react react-icons framer-motion @paper-design/shaders-react @radix-ui/react-accordion @radix-ui/react-slot class-variance-authority @radix-ui/react-icons @radix-ui/react-navigation-menu @radix-ui/react-dialog @radix-ui/react-label clsx tailwind-merge
```

For an existing React app, shadcn's current CLI supports:

```bash
npx shadcn@latest init
npx shadcn@latest add accordion button input label navigation-menu sheet
```

Make sure `tsconfig.json` includes the alias expected by the copied files:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## Integration Questions To Resolve Before Wiring It In

- What app framework should ADK move to: Vite or Next.js?
- Should this generic header be adapted to ADK navigation labels and the existing ADK logo?
- Should state remain local, or should nav/cart state connect to a future store?
- Which image source should power the header/demo pages: local ADK assets, ImageGen outputs, or stock placeholders?
- Should responsive behavior match the current static ADK navigation or replace it completely?
- The provided navbar currently uses remote logo/image props and lucide icons. No Unsplash assets are required until it is adapted into a real ADK page.
