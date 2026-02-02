import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // CORS configuration
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:3002',
    'https://app.BLDCebu.com',
    'https://www.app.BLDCebu.com',
  ];
  
  // Log CORS configuration for debugging
  console.log('🌐 CORS configured for origins:', allowedOrigins);
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed))) {
        return callback(null, true);
      }
      
      // For production, allow Vercel domains and custom domain
      if (process.env.NODE_ENV === 'production') {
        // Allow Vercel domains
        if (origin.includes('.vercel.app')) {
          return callback(null, true);
        }
        // Allow custom domain
        if (origin.includes('BLDCebu.com')) {
          return callback(null, true);
        }
        // Allow Cloud Run domains (for backward compatibility)
        if (origin.includes('.run.app')) {
          return callback(null, true);
        }
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        // Format validation errors for better error messages
        const messages = errors.map((error) => {
          if (error.constraints) {
            return Object.values(error.constraints).join(', ');
          }
          return `${error.property} has invalid value`;
        });
        return new BadRequestException({
          message: messages,
          error: 'Validation failed',
          statusCode: 400,
        });
      },
    })
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('BLD Cebu Online Portal API')
    .setDescription('API documentation for BLD Cebu Online Portal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Root and health endpoints (no api/v1 prefix)
  const basePath = process.env.API_PREFIX || 'api/v1';
  app.getHttpAdapter().get('/', (_req, res) => {
    res.json({
      service: 'BLD Cebu Online Portal API',
      docs: `/api/docs`,
      health: `/health`,
      api: `/${basePath}`,
    });
  });
  app.getHttpAdapter().get('/health', (_req, res) => {
    console.log('✅ Health check endpoint called at', new Date().toISOString());
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'BLD Cebu Online Portal API',
      uptime: process.uptime(),
    });
  });

  const port = process.env.PORT || 4000;
  // Railway requires binding to 0.0.0.0, not localhost
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend server running on http://0.0.0.0:${port}`);
  console.log(`📚 API documentation available at http://0.0.0.0:${port}/api/docs`);
  console.log(`❤️  Health check available at http://0.0.0.0:${port}/health`);
  console.log(`🔍 PORT environment variable: ${process.env.PORT || 'not set (using default 4000)'}`);
  console.log(`🔍 Listening on: 0.0.0.0:${port}`);
}

bootstrap();

