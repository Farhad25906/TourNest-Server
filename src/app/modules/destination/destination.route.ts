import express from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth';
import { DestinationController } from './destination.controller';

const router = express.Router();

router.get('/', DestinationController.getAllDestinations);
router.get('/:id', DestinationController.getSingleDestination);

router.post(
    '/',
    auth(UserRole.ADMIN),
    DestinationController.createDestination
);

router.patch(
    '/:id',
    auth(UserRole.ADMIN),
    DestinationController.updateDestination
);

router.delete(
    '/:id',
    auth(UserRole.ADMIN),
    DestinationController.deleteDestination
);

export const DestinationRoutes = router;
