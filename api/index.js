// Vercel entrypoint: every request is rewritten here (see vercel.json) and handled by the Express app.
// It is the compiled build (`npm run build` -> dist/), so run that before anything imports this file.
import { createApp } from '../dist/app.js';

export default createApp();
