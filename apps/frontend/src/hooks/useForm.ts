import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { z } from 'zod';

type Values = Record<string, string>;
type Errors<T> = Partial<Record<keyof T, string>>;

export function useForm<T extends Values>(schema: z.ZodType<T>, initial: T) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors<T>>({});

  function field(name: keyof T & string) {
    return {
      name,
      value: values[name],
      error: errors[name],
      onChange(event: ChangeEvent<HTMLInputElement>) {
        setValues((current) => ({ ...current, [name]: event.target.value }));
        setErrors((current) => ({ ...current, [name]: undefined }));
      },
    };
  }

  function handleSubmit(onValid: (data: T) => void | Promise<void>) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = schema.safeParse(values);
      if (!result.success) {
        const next: Errors<T> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0] as keyof T;
          next[key] ??= issue.message;
        }
        setErrors(next);
        return;
      }
      return onValid(result.data);
    };
  }

  return { values, field, handleSubmit };
}
