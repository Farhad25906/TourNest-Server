import { IJWTPayload } from '../../app/interfaces/common';

declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;
    }
  }
}