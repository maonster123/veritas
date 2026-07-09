import Link from "next/link";

const PLANS = [
  {
    name: "单次体验",
    nameEn: "One-time",
    price: "9.9",
    unit: "",
    desc: "适合尝试，写一篇论文",
    projects: "1 个项目",
    ai: "50 次 AI 调用",
    export: "DOCX + PDF",
    ref: "完整引用管理",
    popular: false,
    gradient: "from-zinc-600 to-zinc-500",
    border: "border-zinc-700",
    btn: "立即购买",
  },
  {
    name: "包月",
    nameEn: "Monthly",
    price: "19.9",
    unit: "/月",
    desc: "论文冲刺期最划算",
    projects: "5 个项目",
    ai: "200 次 AI / 月",
    export: "DOCX + PDF",
    ref: "完整引用管理",
    popular: true,
    gradient: "from-violet-500 to-purple-600",
    border: "border-violet-500",
    btn: "立即订阅",
  },
  {
    name: "包年",
    nameEn: "Yearly",
    price: "69",
    unit: "/年",
    desc: "重度用户首选，月均 5.75",
    projects: "无限项目",
    ai: "无限 AI 调用",
    export: "DOCX + PDF",
    ref: "完整引用管理",
    popular: false,
    gradient: "from-amber-500 to-orange-500",
    border: "border-amber-600",
    btn: "立即订阅",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <h1 className="text-3xl font-bold text-white mb-2 relative z-10">选择适合你的方案</h1>
      <p className="text-slate-400 text-sm mb-12 relative z-10">内测期间完全免费，正式上线后按需选择</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full relative z-10">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-8 flex flex-col relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
              plan.popular
                ? "bg-gradient-to-b from-violet-950/50 to-[#0b1121] border-2 shadow-lg shadow-violet-500/20"
                : "bg-[#0b1121]/80 border"
            } ${plan.border}`}
          >
            {plan.popular && (
              <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">
                推荐
              </span>
            )}

            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{plan.nameEn}</p>

            <div className="mt-6 mb-6">
              <span className="text-4xl font-bold text-white">¥{plan.price}</span>
              {plan.unit && <span className="text-slate-400 text-sm ml-1">{plan.unit}</span>}
            </div>

            <p className="text-xs text-slate-500 mb-6">{plan.desc}</p>

            <div className="space-y-3 flex-1">
              <Feature text={plan.projects} />
              <Feature text={plan.ai} />
              <Feature text={plan.export} />
              <Feature text={plan.ref} />
            </div>

            <button
              className={`w-full py-3 mt-8 rounded-xl text-sm font-semibold transition-all duration-300 ${
                plan.popular
                  ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl`
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {plan.btn}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-10 relative z-10 flex gap-4">
        <Link
          href="/auth/register"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          注册账号 →
        </Link>
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}
