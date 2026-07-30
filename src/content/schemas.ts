import { z } from 'zod';
export const schemas = {
  home: z.object({
    "FAQ": z.array(z.object({
      "q": z.string(),
      "a": z.string(),
      "id": z.string()
    }))
  }),
  coming_soon: z.object({
    "features": z.array(z.string())
  }),
  maintenance: z.object({
    "updates": z.array(z.string())
  }),
  support: z.object({
    "FAQS": z.array(z.object({
      "q": z.string(),
      "a": z.string(),
      "id": z.string()
    }))
  }),
  demo: z.object({
    "FAQS": z.array(z.object({
      "q": z.string(),
      "a": z.string(),
      "id": z.string()
    })),
    "bars": z.array(z.number())
  })
};
export type Schemas = typeof schemas;