import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserSchema } from '../user/user.schema';
import { ApiFeaturesService } from '../utils/apiFeatures/api-features.service';
import { NotificationController } from './notification.controller';
import { NotificationSchema } from './notification.schema';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Notification', schema: NotificationSchema },
      { name: 'User', schema: UserSchema },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, ApiFeaturesService],
  exports: [NotificationService],
})
export class NotificationModule {}
