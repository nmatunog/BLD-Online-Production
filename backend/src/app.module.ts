import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
// Import other modules as they are implemented
// import { MembersModule } from './members/members.module';
// import { EventsModule } from './events/events.module';
// import { AttendanceModule } from './attendance/attendance.module';
// import { RegistrationsModule } from './registrations/registrations.module';
// import { ReportsModule } from './reports/reports.module';
// import { AccountingModule } from './accounting/accounting.module';
// import { EmailModule } from './email/email.module';
// import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    // Add other modules as they are implemented
    // MembersModule,
    // EventsModule,
    // AttendanceModule,
    // RegistrationsModule,
    // ReportsModule,
    // AccountingModule,
    // EmailModule,
    // PaymentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

