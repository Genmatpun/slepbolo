"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-inchiostro/55 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[101] w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-hidden border-2 border-inchiostro bg-carta shadow-[var(--shadow-alta)] focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Chiudi"
          className="absolute right-5 top-5 grid h-[34px] w-[34px] place-items-center bg-crema text-[17px] text-grigio transition hover:bg-linea"
        >
          ✕
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ titolo, sottotitolo }: { titolo: string; sottotitolo?: string }) {
  return (
    <div className="border-b border-linea px-6 py-5 pr-14">
      <DialogPrimitive.Title className="text-[21px] font-bold tracking-[-0.02em]">
        {titolo}
      </DialogPrimitive.Title>
      {sottotitolo && (
        <DialogPrimitive.Description className="mt-0.5 text-[13.5px] text-grigio">
          {sottotitolo}
        </DialogPrimitive.Description>
      )}
    </div>
  );
}
