import Link from "next/link";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/timeline", label: "时间轴" },
  { href: "/entries/new", label: "新建记录" },
  { href: "/albums", label: "专辑" },
  { href: "/songs", label: "歌曲" },
  { href: "/search", label: "搜索" },
  { href: "/yearly-summary", label: "年度总结" },
];

export function NavBar() {
  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="text-lg font-semibold text-stone-950">
          私人音乐感受档案
        </Link>
        <div className="flex flex-wrap gap-2 text-sm text-stone-600">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
