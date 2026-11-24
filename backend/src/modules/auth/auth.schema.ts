import { z } from 'zod';

export const LoginBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginBody = z.infer<typeof LoginBody>;
