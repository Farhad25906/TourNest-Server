
import { z } from 'zod';

// Empty schema since we're not validating anything
const getPaymentsValidationSchema = z.object({}).partial();

export const PaymentValidation = {
  getPaymentsValidationSchema
};
