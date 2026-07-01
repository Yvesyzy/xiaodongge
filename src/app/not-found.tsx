import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-narrow space-y-4">
      <h1 className="section-title">没有找到页面</h1>
      <p className="section-subtitle">这条记录或页面不存在。</p>
      <Link href="/timeline" className="btn-primary">
        返回时间轴
      </Link>
    </div>
  );
}
