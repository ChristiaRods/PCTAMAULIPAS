import { AlertTriangle, Activity, Eye, ChevronRight } from "lucide-react";
import { useNavigate } from "./RouterContext";
import { PCShieldIcon } from "./PCShieldIcon";

const roles = [
  {
    id: "campo-911",
    label: "Reportes 911",
    subtitle: "Personal de Campo",
    icon: AlertTriangle,
    path: "/911",
    color: "bg-[#FF3B30]",
  },
  {
    id: "campo-monitoreo",
    label: "Monitoreo",
    subtitle: "Personal de Campo",
    icon: Activity,
    path: "/monitoreo",
    color: "bg-primary",
  },
  {
    id: "coordinador",
    label: "Coordinador Regional",
    subtitle: "Supervisión",
    icon: Eye,
    path: "/supervisor",
    color: "bg-secondary",
  },
];

export function LoginScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A0408] via-[#4A0C1A] to-[#8C1530] flex flex-col relative overflow-hidden"
      style={{
        paddingTop:
          "var(--pc-safe-top-effective, env(safe-area-inset-top, 0px))",
      }}
    >
      {/* Ambient light circles */}
      <div className="absolute top-[-20%] left-[-30%] w-[80vw] h-[80vw] rounded-full bg-[#AB1738]/8 blur-3xl" />
      <div className="absolute bottom-[30%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-white/[0.03] blur-3xl" />

      {/* Logo area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 relative z-10">
        <div
          className="w-[88px] h-[88px] rounded-[22px] flex items-center justify-center mb-5 overflow-hidden"
          style={{
            boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.10)",
          }}
        >
          <PCShieldIcon size={88} />
        </div>
        <h1 className="text-[28px] text-white tracking-tight text-center">Protección Civil</h1>
        <p className="text-white/40 text-[15px] mt-1 tracking-wide">Estado de Tamaulipas</p>
      </div>

      {/* Role selection — frosted sheet */}
      <div
        className="relative z-10 rounded-t-[28px] px-5 pt-7 space-y-3"
        style={{
          background: "rgba(242, 241, 239, 0.92)",
          backdropFilter: "saturate(180%) blur(40px)",
          WebkitBackdropFilter: "saturate(180%) blur(40px)",
          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.6), 0 -12px 40px rgba(0,0,0,0.25)",
          paddingBottom:
            "max(var(--pc-nav-bottom-offset, 0px), 16px)",
        }}
      >
        <p className="text-center text-muted-foreground text-[15px] mb-1">Selecciona tu perfil para continuar</p>
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => {
              localStorage.setItem("pc-current-role", role.id);
              navigate(role.path);
            }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl active:scale-[0.97] transition-all duration-200"
            style={{
              background: "var(--glass-bg-heavy)",
              boxShadow: "var(--shadow-card), var(--glass-highlight)",
              border: "0.5px solid rgba(255,255,255,0.5)",
            }}
          >
            <div className={`w-12 h-12 rounded-[14px] ${role.color} flex items-center justify-center shrink-0 shadow-sm`}>
              <role.icon className="w-6 h-6 text-white" strokeWidth={1.8} />
            </div>
            <div className="text-left flex-1">
              <p className="text-[16px] text-foreground tracking-tight">{role.label}</p>
              <p className="text-[14px] text-muted-foreground">{role.subtitle}</p>
            </div>
            <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/40" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  );
}
