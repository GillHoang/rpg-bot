import { MenuRouter } from './MenuRouter.js';

// One router/store shared by /menu and the component dispatcher. No timers at import time.
export const menuRouter = new MenuRouter();
