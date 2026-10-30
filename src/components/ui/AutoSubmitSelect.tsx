"use client";

import type { SelectHTMLAttributes } from "react";

/**
 * Tanlov o'zgarishi bilan formani yuboradigan <select> — server komponentli GET formalar uchun
 * (telefonda katta «Qidirish» tugmasi yashirin; tanlash = qidirish, Telegram/Instagram filtr odati).
 */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(e) => {
        props.onChange?.(e);
        e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}
