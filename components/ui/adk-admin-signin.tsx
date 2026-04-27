"use client"

import * as React from "react"
import { ArrowRight, Eye, EyeOff, ShieldCheck, Wrench } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type AdkAdminSigninProps = React.HTMLAttributes<HTMLElement> & {
  logoSrc?: string
  onMockSubmit?: (values: { email: string; password: string }) => void
}

function TechnicalDotGridCanvas({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const prefersReducedMotion = useReducedMotion()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    let animationFrame = 0
    let frame = 0
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio))
      canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio))
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const spacing = 36
      const drift = prefersReducedMotion ? 0 : Math.sin(frame / 90) * 8

      context.clearRect(0, 0, width, height)
      context.fillStyle = "#20272B"
      context.fillRect(0, 0, width, height)

      context.strokeStyle = "rgba(47, 141, 170, 0.16)"
      context.lineWidth = 1
      for (let x = -spacing; x < width + spacing; x += spacing) {
        context.beginPath()
        context.moveTo(x + drift, 0)
        context.lineTo(x - 60 + drift, height)
        context.stroke()
      }

      for (let y = 0; y < height + spacing; y += spacing) {
        context.beginPath()
        context.moveTo(0, y)
        context.lineTo(width, y + drift * 0.35)
        context.stroke()
      }

      const nodes = [
        [0.18, 0.22, "#2F8DAA"],
        [0.34, 0.46, "#1F5F7A"],
        [0.58, 0.32, "#D88A28"],
        [0.74, 0.62, "#2F8DAA"],
        [0.43, 0.76, "#D88A28"],
      ] as const

      context.strokeStyle = "rgba(244, 241, 234, 0.45)"
      context.lineWidth = 1.4
      context.beginPath()
      nodes.forEach(([x, y], index) => {
        const px = x * width
        const py = y * height
        if (index === 0) context.moveTo(px, py)
        else context.lineTo(px, py)
      })
      context.stroke()

      nodes.forEach(([x, y, color], index) => {
        const px = x * width
        const py = y * height
        const pulse = prefersReducedMotion ? 0 : Math.sin(frame / 28 + index) * 1.8
        context.fillStyle = color
        context.beginPath()
        context.arc(px, py, 3.5 + pulse, 0, Math.PI * 2)
        context.fill()

        context.strokeStyle = color.replace(")", ", 0.18)")
        context.beginPath()
        context.arc(px, py, 18 + pulse * 2, 0, Math.PI * 2)
        context.stroke()
      })

      context.fillStyle = "rgba(244, 241, 234, 0.54)"
      context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace"
      context.fillText("CAD GRID / INTERNAL ACCESS", 24, height - 28)

      frame += 1
      if (!prefersReducedMotion) {
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    resize()
    draw()
    window.addEventListener("resize", resize)

    return () => {
      window.removeEventListener("resize", resize)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [prefersReducedMotion])

  return <canvas ref={canvasRef} className={cn("absolute inset-0 size-full", className)} aria-hidden="true" />
}

export default function AdkAdminSignin({
  logoSrc = "https://d2xsxph8kpxj0f.cloudfront.net/310419663029344895/Y6P4wESsnqturPWjC5KcFB/adk-logo-badge_452696c8.png",
  className,
  onMockSubmit,
  ...props
}: AdkAdminSigninProps) {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "submitting" | "ready">("idle")
  const prefersReducedMotion = useReducedMotion()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus("submitting")

    // Development-only placeholder. Replace with real server-side authentication
    // and secure sessions before using this admin flow in production.
    window.setTimeout(() => {
      onMockSubmit?.({ email, password })
      setStatus("ready")
    }, 650)
  }

  return (
    <section
      className={cn(
        "grid min-h-[100dvh] place-items-center bg-[#F4F1EA] px-4 py-8 text-[#1E2428]",
        className,
      )}
      {...props}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[#C8C3B8] bg-[#FBF8F0] shadow-[0_28px_90px_rgba(30,36,40,0.16)] lg:grid-cols-[1.08fr_0.92fr]"
      >
        <div className="relative hidden min-h-[620px] overflow-hidden bg-[#20272B] lg:block">
          <TechnicalDotGridCanvas />
          <div className="relative z-[1] flex min-h-full flex-col justify-end p-10 text-[#F4F1EA]">
            <img src={logoSrc} alt="" className="mb-6 h-14 w-14 object-contain" />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#2F8DAA]">
              ADK Admin
            </p>
            <h1 className="mt-3 max-w-[12ch] text-4xl font-medium leading-none tracking-tight">
              Internal fabrication command center.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#F4F1EA]/75">
              Manage store products, quote requests, build requests, shop work, and site settings.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-[#F4F1EA]/76">
              <span className="flex items-center gap-2 border border-white/10 bg-white/[0.03] p-3">
                <ShieldCheck className="size-4 text-[#2F8DAA]" />
                Protected area
              </span>
              <span className="flex items-center gap-2 border border-white/10 bg-white/[0.03] p-3">
                <Wrench className="size-4 text-[#D88A28]" />
                Site controls
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid content-center gap-5 p-6 sm:p-10">
          <img src={logoSrc} alt="After Dark Kreations ADK logo" className="h-14 w-14 object-contain" />
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#1F5F7A]">
              Secure Area
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-[#5F6A70]">Sign in to manage ADK.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="border-[#C8C3B8] bg-white/70 focus-visible:ring-[#1F5F7A]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="admin-password">Password</Label>
            <div className="grid grid-cols-[1fr_auto] border border-[#C8C3B8] bg-white/70 focus-within:ring-2 focus-within:ring-[#1F5F7A]">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="px-3 text-[#1F5F7A]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={status === "submitting"}
            className="group mt-1 bg-[#1E2428] text-[#F4F1EA] hover:bg-[#20272B]"
          >
            {status === "submitting" ? "Checking access" : "Sign in"}
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
          </Button>

          <a href="/contact" className="text-sm font-semibold text-[#1F5F7A] hover:underline">
            Forgot password?
          </a>
          <p className="text-xs leading-5 text-[#6F8794]">
            Mock login only. Store no real credentials in this client component; connect a server-side
            auth provider before production admin use.
          </p>
        </form>
      </motion.div>
    </section>
  )
}
