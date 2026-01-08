// tour.route.ts
import express, { NextFunction, Request, Response } from 'express';
import { TourController } from './tour.controller';
import { fileUploader } from '../../helper/fileUploader';
import { TourValidation } from './tour.validation';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { checkTourCreationLimit } from '../../middlewares/subscription.middleware';

const router = express.Router();

// Create tour - only hosts can create
router.post(
  '/create-tour',
  auth(UserRole.HOST),
   checkTourCreationLimit,
  fileUploader.upload.single('file'), // Single file upload like user routes
  (req: Request, res: Response, next: NextFunction) => {
    // Parse JSON data from req.body.data (EXACTLY like user routes)
    try {
      if (req.body.data) {
        console.log(req.body.data);
        
        const parsedData = JSON.parse(req.body.data);
        req.body = TourValidation.createTourValidationSchema.parse(parsedData);
      } else {
        throw new Error('Data field is required. Send JSON in data field.');
      }
    } catch (error) {
      return next(error);
    }
    return TourController.createTour(req, res, next);
  }
);

// Get all tours - public access
router.get(
  '/',
  TourController.getAllTours
);

// Get single tour - public access
router.get(
  '/:id',
  TourController.getSingleTour
);

router.get(
  '/host/my-tours',
  auth(UserRole.HOST),
  TourController.getHostTours
);

// Get host tour statistics
router.get(
  '/host/stats',
  auth(UserRole.HOST),
  TourController.getHostTourStats
);

// Get single tour - host only (with additional host-specific info)
router.get(
  '/host/my-tours/:id',
  auth(UserRole.HOST),
  TourController.getHostSingleTour
);


// Update tour - only host who created it or admin
router.patch(
  '/:id',
  auth(UserRole.HOST, UserRole.ADMIN),
  fileUploader.upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    // Parse JSON data from req.body.data
    try {
      if (req.body.data) {
        const parsedData = JSON.parse(req.body.data);
        req.body = TourValidation.updateTourValidationSchema.parse(parsedData);
      } else if (Object.keys(req.body).length > 0) {
        // Allow direct body for updates without files
        req.body = TourValidation.updateTourValidationSchema.parse(req.body);
      }
    } catch (error) {
      return next(error);
    }
    return TourController.updateTour(req, res, next);
  }
);

// Delete tour - only host who created it or admin
router.delete(
  '/:id',
  // auth(UserRole.HOST, UserRole.ADMIN),
  TourController.deleteTour
);

export const tourRoutes = router;