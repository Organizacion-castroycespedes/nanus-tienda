import { ValidationPipe } from "@nestjs/common";

export const financeValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
