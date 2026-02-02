import { Host, Subscription } from '@prisma/client';
import { IJWTPayload } from '../common';

declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;
      host?: Host;
      subscription?: Subscription;
    }
  }
}

export { };