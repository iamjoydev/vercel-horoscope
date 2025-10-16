# Vedic Horoscope Vercel App (Bengali narrative style)

## Quickstart
1. cd vedic-horoscope-vercel
2. npm install
3. npm run dev
4. Deploy: vercel --prod

## API
GET /api/horoscope
Optional query params:
 - date=YYYY-MM-DD
 - tz=Asia/Kolkata

Returns JSON with daily horoscope (Bengali narrative) for all 12 signs.

## Embed
Use the public/embed.js after deployment:
<div id="vh-root"></div>
<script src="https://<your-deploy>.vercel.app/embed.js" data-endpoint="https://<your-deploy>.vercel.app/api/horoscope"></script>
