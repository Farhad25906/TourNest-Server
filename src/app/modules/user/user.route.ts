import { UserRole } from "@prisma/client";
import express, { NextFunction, Request, Response } from "express";
import { UserController } from "./user.controller";

import { fileUploader } from "../../helper/fileUploader";
import { UserValidation } from "./user.validation";
import auth from "../../middlewares/auth";

const router = express.Router();

router.get("/", auth(UserRole.ADMIN), UserController.getAllFromDB);

router.get(
  "/me",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  UserController.getMyProfile
);

router.post(
  "/create-tourist",
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = UserValidation.createTouristValidationSchema.parse(
      JSON.parse(req.body.data)
    );
    return UserController.createTourist(req, res, next);
  }
);

router.post(
  "/create-admin",
  // auth(UserRole.ADMIN),
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = UserValidation.createAdminValidationSchema.parse(
      JSON.parse(req.body.data)
    );
    return UserController.createAdmin(req, res, next);
  }
);

router.post(
  "/create-host",
  auth(UserRole.ADMIN),
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    console.log(JSON.parse(req.body.data));
    req.body = UserValidation.createHostValidationSchema.parse(
      JSON.parse(req.body.data)
    );
    return UserController.createHosts(req, res, next);
  }
);
router.patch(
  "/update-my-profile",
  auth(UserRole.ADMIN, UserRole.HOST, UserRole.TOURIST),
  fileUploader.upload.single("file"),
  (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    let validationSchema;

    if (user?.role === UserRole.TOURIST) {
      validationSchema = UserValidation.updateTouristValidationSchema;
    } else if (user?.role === UserRole.HOST) {
      validationSchema = UserValidation.updateHostValidationSchema;
    } else if (user?.role === UserRole.ADMIN) {
      validationSchema = UserValidation.updateAdminValidationSchema;
    } else {
      return next(new Error("Invalid user role"));
    }
    // console.log(req.body.data);
    

    // Parse the JSON data
    if (req.body.data) {
      try {
        req.body = validationSchema.parse(JSON.parse(req.body.data));
        // console.log(req.body);
        
      } catch (error) {
        // Handle trailing comma in JSON
        try {
          const fixedJson = req.body.data
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");
          req.body = validationSchema.parse(JSON.parse(fixedJson));
        } catch (secondError) {
          return next(secondError);
        }
      }
    } else {
      // If no data field, validate the body directly
      req.body = validationSchema.parse(req.body);
    }

    return UserController.updateMyProfile(req, res, next);
  }
);
router.patch(
  "/:id/status",
  auth(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction) => {
    req.body = UserValidation.updateStatusValidationSchema.parse(req.body);
    return UserController.changeProfileStatus(req, res, next);
  }
);
router.delete("/:id", auth(UserRole.ADMIN), UserController.deleteUser);

export const userRoutes = router;
