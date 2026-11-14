import { z } from 'zod';

export const emailSchema = z.string().trim().min(3).max(200).email().toLowerCase();
const nameSchema = z.string().trim().min(1).max(80);
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const registerSchema = loginSchema.extend({
  name: nameSchema,
  password: z.string().min(8).max(128),
});
export const configSchema = z
  .object({
    prefix: z
      .string()
      .regex(/^[A-Z0-9]{1,16}$/)
      .default('NOVA'),
    alphabet: z
      .string()
      .min(2)
      .max(36)
      .regex(/^[A-Z0-9]+$/)
      .refine((v) => new Set(v).size === v.length)
      .default('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
    segmentCount: z.number().int().min(1).max(8).default(4),
    segmentLength: z.number().int().min(1).max(16).default(5),
    separator: z.enum(['-', '_']).default('-'),
    checksum: z.boolean().default(true),
    validityDays: z.number().int().min(1).max(36500).nullable().default(365),
  })
  .strict()
  .refine(
    (v) => v.segmentCount * v.segmentLength * Math.log2(v.alphabet.length) >= 80,
    'Format requires at least 80 bits of randomness',
  );
export type KeyFormat = z.output<typeof configSchema>;
export const createConfigSchema = z
  .object({
    name: nameSchema,
    description: z.string().trim().max(500).default(''),
    format: configSchema,
  })
  .strict();
export const cartSchema = z
  .array(
    z
      .object({ id: z.number().int().positive(), quantity: z.number().int().min(1).max(10) })
      .strict(),
  )
  .min(1)
  .max(20)
  .refine((items) => new Set(items.map((i) => i.id)).size === items.length, 'Duplicate products');
export const orderSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    address: z.string().trim().min(1).max(200),
    postcode: z.string().regex(/^\d{2}-\d{3}$/),
    city: nameSchema,
    items: cartSchema,
  })
  .strict();
export const jobSchema = z
  .object({
    configVersionId: z.uuid(),
    ownerId: z.uuid().optional(),
    recipientEmail: emailSchema.optional(),
  })
  .strict();
export const verifySchema = z.object({ key: z.string().min(1).max(512) }).strict();
export const envelopeSchema = z
  .object({
    version: z.literal(1),
    messageId: z.uuid(),
    eventId: z.uuid(),
    type: z.enum(['license.generation.requested', 'license.generated']),
    entityId: z.uuid(),
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export const queues = {
  generation: 'license.generate',
  email: 'notification.email',
  metrics: 'notification.metrics',
} as const;
export type Queue = (typeof queues)[keyof typeof queues];
export const queueSchema = z.enum([queues.generation, queues.email, queues.metrics]);
export type UserDto = { name: string; email: string };
export type ProductDto = {
  id: number;
  name: string;
  description: string;
  price: number;
  features: string[];
};
export type OrderDto = { id: number; total: number; items: { name: string; keys: string[] }[] };
export type Verification = 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED';
export { z };
