'use client';

import { SignUp } from '@clerk/nextjs';
import Logo from '../../Logo';

export default function SignUpPage() {
  return (
    <div className="w-full max-w-[400px] flex flex-col items-center">
      <Logo className="w-80 h-auto mb-8" />
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full',
            cardBox: 'w-full !bg-transparent !shadow-none !border-none',
            card: '!bg-transparent !shadow-none !border-none p-0 w-full',
            main: '!bg-transparent w-full',
            footer: 'w-full bg-transparent',
            headerTitle: 'font-display text-2xl font-bold text-zinc-800 text-center mb-1',
            headerSubtitle: 'text-zinc-500 text-sm text-center mb-6',
            socialButtonsBlockButton: 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition rounded-xl py-2.5 shadow-sm w-full',
            socialButtonsBlockButtonText: 'font-sans font-medium text-zinc-600',
            formButtonPrimary: 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white transition py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98] duration-150 cursor-pointer w-full',
            formFieldLabel: 'text-zinc-600 text-xs font-semibold mb-1',
            formFieldInput: 'border-zinc-200 bg-white text-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 py-2.5 transition duration-150 shadow-sm w-full',
            footerActionText: 'text-zinc-400 text-sm',
            footerActionLink: 'text-emerald-600 hover:text-emerald-700 font-semibold transition',
            identityPreviewText: 'text-zinc-600',
            identityPreviewEditButton: 'text-emerald-600 hover:text-emerald-700',
            dividerLine: 'bg-zinc-200',
            dividerText: 'text-zinc-400 text-xs px-2',
          }
        }}
      />
    </div>
  );
}
