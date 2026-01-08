// subscription.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../shared/prisma';
import { IJWTPayload } from '../types/common';

export const checkTourCreationLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IJWTPayload;
    
    if (!user || user.role !== 'HOST') {
      return res.status(403).json({
        success: false,
        message: 'Only hosts can create tours'
      });
    }

    const host = await prisma.host.findUnique({
      where: { email: user.email },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        message: 'Host not found'
      });
    }

    // Calculate current limits
    let tourLimit = host.tourLimit;
    let canCreateTour = host.currentTourCount < tourLimit;

    // If host has active subscription, check subscription limits
    if (host.subscription && host.subscription.status === 'ACTIVE') {
      const subscription = host.subscription;
      
      // Check if subscription is still valid
      if (new Date() > subscription.endDate) {
        // Subscription expired, downgrade to free
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' }
        });
        
        await prisma.host.update({
          where: { id: host.id },
          data: {
            tourLimit: 4,
            blogLimit: 5
          }
        });
        
        canCreateTour = host.currentTourCount < 4;
      } else {
        // Use subscription limits
        tourLimit = subscription.tourLimit;
        const remainingTours = subscription.remainingTours;
        canCreateTour = remainingTours > 0;
      }
    }

    if (!canCreateTour) {
      return res.status(403).json({
        success: false,
        message: `You have reached your tour limit (${host.currentTourCount}/${tourLimit}). Please upgrade your subscription to create more tours.`,
        data: {
          currentCount: host.currentTourCount,
          tourLimit,
          canUpgrade: true
        }
      });
    }

    // Add host info to request for use in controller
    (req as any).hostInfo = host;
    next();
  } catch (error: any) {
    console.error('Error checking tour creation limit:', error);
    next(error);
  }
};

export const checkBlogCreationLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IJWTPayload;
    
    if (!user || user.role !== 'HOST') {
      return res.status(403).json({
        success: false,
        message: 'Only hosts can create blogs'
      });
    }

    const host = await prisma.host.findUnique({
      where: { email: user.email },
      include: {
        subscription: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!host) {
      return res.status(404).json({
        success: false,
        message: 'Host not found'
      });
    }

    let canCreateBlog = false;
    let blogLimit = host.blogLimit;
    let message = '';

    // Check if host has active subscription
    if (host.subscription && host.subscription.status === 'ACTIVE') {
      const subscription = host.subscription;
      
      // Check if subscription is still valid
      if (new Date() > subscription.endDate) {
        // Subscription expired
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' }
        });
        
        // Downgrade to free plan (5 blogs)
        await prisma.host.update({
          where: { id: host.id },
          data: {
            tourLimit: 4,
            blogLimit: 5
          }
        });
        
        blogLimit = 5;
        canCreateBlog = host.currentBlogCount < 5;
        message = `You have reached your blog limit (${host.currentBlogCount}/5). Please upgrade your subscription.`;
      } else {
        // Active subscription
        if (subscription.blogLimit === null) {
          // Premium plan - unlimited blogs
          canCreateBlog = true;
        } else {
          // Standard plan - limited blogs
          const remainingBlogs = subscription.remainingBlogs || (subscription.blogLimit - host.currentBlogCount);
          canCreateBlog = remainingBlogs > 0;
          blogLimit = subscription.blogLimit;
          message = `You have reached your blog limit (${host.currentBlogCount}/${subscription.blogLimit}). Please upgrade your subscription.`;
        }
      }
    } else {
      // Free plan - 5 blogs
      canCreateBlog = host.currentBlogCount < 5;
      message = `You have reached your blog limit (${host.currentBlogCount}/5). Please upgrade your subscription.`;
    }

    if (!canCreateBlog) {
      return res.status(403).json({
        success: false,
        message,
        data: {
          currentCount: host.currentBlogCount,
          blogLimit,
          canUpgrade: true
        }
      });
    }

    // Add host info to request
    (req as any).hostInfo = host;
    next();
  } catch (error: any) {
    console.error('Error checking blog creation limit:', error);
    next(error);
  }
};