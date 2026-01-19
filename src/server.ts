// server.ts (updated)
import { Server } from 'http';
import app from './app';
import config from './config';
import { seedSubscriptionPlansOnStartup } from './app/shared/seedSubscriptionPlans';


async function bootstrap() {
  let server: Server;

  try {
    // Auto-seed subscription plans on server start
    console.log('🚀 Starting server initialization...');
    
    try {
      await seedSubscriptionPlansOnStartup();
      console.log('✅ Subscription plans check completed');
    } catch (error) {
      console.warn('⚠️ Subscription plan seeding failed, but server will continue:', error);
    }

    // Start the server
    server = app.listen(config.port, () => {
      console.log(`🚀 Server is running on http://localhost:${config.port}`);
    });

    // Graceful shutdown
    const exitHandler = () => {
      if (server) {
        server.close(() => {
          console.log('Server closed gracefully.');
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    };

    process.on('unhandledRejection', (error) => {
      console.log('Unhandled Rejection detected, closing server...');
      if (server) {
        server.close(() => {
          console.log(error);
          process.exit(1);
        });
      } else {
        process.exit(1);
      }
    });

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      exitHandler();
    });

  } catch (error) {
    console.error('Error during server startup:', error);
    process.exit(1);
  }
}

bootstrap();