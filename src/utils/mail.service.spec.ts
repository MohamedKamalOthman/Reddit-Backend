import { EmailService } from './mail.service';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { MailerServiceMock } from './__mocks__/mailer.service';
import { HttpException } from '@nestjs/common';
/**
 * Test for Mail Service
 */
describe('EmailService', () => {
  let service: EmailService;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [EmailService, MailerService],
    })
      .overrideProvider(MailerService)
      .useValue(MailerServiceMock)
      .compile();
    service = module.get<EmailService>(EmailService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('sendMail', () => {
    test('should send email normally', async () => {
      expect(async () => {
        await service.sendEmail('throw', 'a', 'a');
      }).rejects.toThrow(HttpException);
    });
    test('should throw error', async () => {
      expect(async () => {
        await service.sendEmail('NotThrow', 'a', 'a');
      }).rejects.not.toThrow();
    });
  });
});
