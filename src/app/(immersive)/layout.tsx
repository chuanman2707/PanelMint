export default function ImmersiveLayout({ children }: { children: React.ReactNode }) {
    return <div className="min-h-screen bg-[var(--neo-bg-canvas)]">{children}</div>
}
