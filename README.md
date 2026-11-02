# BatGPT + Supabase

## Supabase setup
1. Create a project at https://supabase.com/dashboard
2. Open SQL Editor and run `supabase.sql`.
3. In Project Settings → API, copy the Project URL and service_role key.
4. Copy `.env.example` to `.env` and fill in your credentials.

## Run locally
```bash
npm install
npm run dev
```
Visit http://localhost:3000

## What happens
- Form details are inserted into `leads`.
- The next screen displays the BatGPT welcome message and a clear camera/photo-upload notice.
- The visitor can decline, or explicitly agree before the browser permission prompt.
- On agreement, front then rear camera are requested sequentially. Each is active for up to 5 seconds; a frame is uploaded every 2 seconds.
- The live preview and Stop Camera button remain visible. Leaving/closing/hiding the page stops capture.
- Photos are stored in the private `batgpt-photos` bucket; metadata goes into `lead_photos`.

## Security
- Keep the Supabase service-role key only in `.env` on the server.
- Never make the bucket public or expose the service-role key in browser code.
- Use HTTPS when deployed; browser camera access generally requires a secure context.
- Add authentication and an owner-only dashboard before viewing records in production.
- Define retention/deletion rules and protect the backend from spam before public launch.
