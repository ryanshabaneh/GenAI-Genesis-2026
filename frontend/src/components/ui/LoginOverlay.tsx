'use client'

import { useSearchParams } from 'next/navigation'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

const AUTH_ERRORS: Record<string, string> = {
  denied: 'GitHub sign-in was cancelled.',
  error:  'Something went wrong on our end — try again?',
}

export default function LoginOverlay() {
  const params = useSearchParams()
  const authError = params.get('auth') ? AUTH_ERRORS[params.get('auth')!] : null

  return (
    <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
      <div className="overlay rounded-[18px] flex flex-col items-center gap-6 px-10 py-10 w-full max-w-sm text-center">

        {/* logo mark */}
        <div className="w-12 h-12 rounded-[14px] bg-amber flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="#090C12" strokeWidth="2.5"/>
            <circle cx="12" cy="12" r="3" fill="#090C12"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div>
          <h1 className="font-display text-[28px] font-black tracking-tight text-white leading-none">
            Ship<span className="text-amber">City</span>
          </h1>
          <p className="text-fog-light text-sm font-ui mt-2 leading-relaxed">
            Turn your project into a production-ready codebase, ship and set sail.
          </p>
        </div>

        {authError && (
          <p className="text-amber text-xs font-ui -mt-2">{authError}</p>
        )}

        {/* GH OAuth button */}
        <a
          href={`${API_URL}/api/auth/github`}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-[999px] bg-amber text-ink font-display font-black text-sm transition-all duration-[120ms] ease-linear hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.97]"
        >
          <GitHubIcon className="w-4 h-4 shrink-0" />
          Sign in with GitHub
        </a>

        <p className="text-fog text-xs font-ui">
          We only read your repo. No surprises.
        </p>
      </div>
    </div>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}
