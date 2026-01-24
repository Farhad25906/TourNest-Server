import express from 'express';
import { userRoutes } from '../modules/user/user.route';
import { authRoutes } from '../modules/auth/auth.routes';
import { tourRoutes } from '../modules/tour/tour.route';
import { bookingRoutes } from '../modules/bookings/booking.route';
import { subscriptionRoutes } from '../modules/subscription/subscription.route';
import { blogRoutes } from '../modules/blog/blog.route';
import { reviewRoutes } from '../modules/review/review.route';
import { paymentRoutes } from '../modules/payment/payment.route';
import { metaRoutes } from '../modules/meta/meta.route';



const router = express.Router();

const moduleRoutes = [
    {
        path: '/users',
        route: userRoutes
    },
    {
        path: '/auth',
        route: authRoutes
    },
    {
        path: '/tour',
        route: tourRoutes
    },
    {
        path: '/bookings',
        route: bookingRoutes
    },
    {
        path: '/subscriptions',
        route: subscriptionRoutes
    },
    {
        path: '/reviews',
        route: reviewRoutes
    },
    {
        path: '/blogs',
        route: blogRoutes
    },
    {
        path: '/payments',
        route: paymentRoutes
    },
    {
        path: '/meta',
        route: metaRoutes
    }
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;