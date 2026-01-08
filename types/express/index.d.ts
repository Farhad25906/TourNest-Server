// types/express/index.d.ts
import { Host, Subscription } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      host?: Host;
      subscription?: Subscription;
    }
  }
}

export {};