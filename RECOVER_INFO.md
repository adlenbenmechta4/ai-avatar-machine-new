# AI Avatar Machine - Recovery Information

## Project Overview

- **Framework:** Next.js 15 + TypeScript + Tailwind CSS
- **Database:** Prisma + PostgreSQL
- **Authentication:** NextAuth + Firebase
- **File Storage:** @vercel/blob
- **AI Integration:** HeyGen (avatar video generation)
- **Live URL:** https://my-project-pink-eta.vercel.app

## Recovery Status

### Recovered
- Project file structure (550 files)
- Package dependencies
- Configuration files (next.config.ts, tailwind.config.ts, tsconfig.json)
- Global CSS styles
- UI component library (shadcn/ui)

### Needs Manual Restoration
All source code files need to be restored from the Vercel Web Editor:
- `src/app/page.tsx` - Main application page
- `src/components/AIAvatarMachine.tsx` - Core video generation component
- `src/components/MainMenu.tsx` - Navigation component
- `src/components/VideoLibrary.tsx` - Video management component
- `src/lib/*.ts` - All library files (auth, db, credits, firebase, etc.)
- `src/app/api/*/route.ts` - All API routes
- `prisma/schema.prisma` - Database schema
- `src/providers/*.tsx` - Auth and session providers

## How to Restore

### Step 1: Access Vercel Web Editor
1. Go to: https://vercel.com/adlenbenmechta2-9356s-projects/my-project
2. Click on "Code" or navigate to the source viewer
3. Click on the deployment ID to view source files

### Step 2: Copy Each File
For each file listed above:
1. Open the file in the Vercel Web Editor
2. Select all content (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste into the corresponding local file
5. Save the file

### Step 3: Verify
After restoring all files:
```bash
npm install
npm run dev
```

## Environment Variables Required
The following environment variables are needed:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `NEXTAUTH_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob read/write token
- `HEYGEN_API_KEY` - HeyGen API key (for avatar video generation)

## Prevention
To prevent source code loss in the future:
1. Always connect your Vercel project to a Git repository (GitHub, GitLab, Bitbucket)
2. Never deploy directly from CLI without a Git repository
3. Use `git push` to deploy instead of `vercel deploy`
4. Keep local copies of your source code
