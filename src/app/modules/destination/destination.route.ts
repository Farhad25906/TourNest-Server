import express, { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth';
import { DestinationController } from './destination.controller';
import { fileUploader } from '../../helper/fileUploader';

const router = express.Router();

router.get('/', DestinationController.getAllDestinations);
router.get('/:id', DestinationController.getSingleDestination);

router.post(
    '/',
    auth(UserRole.ADMIN),
    fileUploader.upload.single('file'), // Support single image upload
    (req: Request, res: Response, next: NextFunction) => {
        // Parse JSON data from req.body.data if present
        try {
            if (req.body.data) {
                const parsedData = JSON.parse(req.body.data);
                req.body = { ...req.body, ...parsedData };
            }
        } catch (error) {
            return next(error);
        }
        return DestinationController.createDestination(req, res, next);
    }
);

router.patch(
    '/:id',
    auth(UserRole.ADMIN),
    fileUploader.upload.single('file'), // Support single image upload
    (req: Request, res: Response, next: NextFunction) => {
        // Parse JSON data from req.body.data if present
        try {
            if (req.body.data) {
                const parsedData = JSON.parse(req.body.data);
                req.body = { ...req.body, ...parsedData };
            }
        } catch (error) {
            return next(error);
        }
        return DestinationController.updateDestination(req, res, next);
    }
);

router.delete(
    '/:id',
    auth(UserRole.ADMIN),
    DestinationController.deleteDestination
);

export const DestinationRoutes = router;
