import { Link } from "react-router-dom";

export default function CompatibilityPage() {
  return <section className="page">
    <h1>鸿蒙与兼容环境</h1>
    <p className="lead">手动记录与本地档案照常使用。文件、相册和当前播放的可用方式取决于系统提供的能力。</p>
    <Link to="/more">返回更多</Link>
    <section className="form-card"><h2>找不到备份或截图文件</h2>
      <p>使用卓易通的鸿蒙 5/5.1，可打开“卓易通 → 我的 → 文件互传”，点“＋”将系统文件导入，再回到小懂哥选择。首次使用时按系统提示授权。</p>
      <p>鸿蒙 6 及以上可直接选择系统文件；选择器中可查找 MyHarmonyDevice（“我的设备(鸿蒙)”）。仍找不到时可尝试文件互传。</p>
      <p>备份页也支持直接粘贴完整 JSON，仍会先校验、预演，再确认恢复。</p><Link to="/backup">打开备份</Link>
    </section>
    <section className="form-card"><h2>图片已保存，系统图库却没看到</h2>
      <p>在图片预览中可选择“保存到相册”。兼容环境中的相册可能与系统图库分开；可通过“文件互传”找到图片并导出到系统图库。</p>
      <p>文件管理中也可查找“我的手机 → 兼容应用数据”。图库可按创建时间排序，查找新保存的图片。旧系统若不支持相册保存，仍可尝试另存文件或系统分享。</p>
    </section>
    <section className="form-card"><h2>读取不到当前播放</h2>
      <p>应用通知开关与“通知使用权”不同，兼容环境也可能无法读取其他应用的播放信息。可改用粘贴音乐信息、系统分享、截图识别，或手动记录；截图识别需要先同意增强功能的数据处理。</p>
      <p>卓易通内普通通知与权限，可在其应用管理中查看；鸿蒙 6 及以上也可在系统的应用和元服务设置中管理。具体入口以设备显示为准。</p><Link to="/capture">打开速记</Link>
    </section>
    <section className="form-card"><h2>保存、复制或恢复提示不可用</h2>
      <p>保存和分享失败后，备份原文仍留在预览框中，可长按选择或尝试“复制内容”。缺少安全恢复能力时，会保留当前档案并暂停导入与撤销，可先导出备份，再更新系统及网页组件。</p>
      <p>在删除应用数据或卸载兼容运行环境前，请先保留可用的 JSON 备份。</p><Link to="/diagnostics">查看本机诊断</Link>
    </section>
    <p className="hint">说明依据官方公开文档，实际支持以设备和运行环境为准。</p>
    <p><a href="https://www.droitong.com/CommonQues.html" target="_blank" rel="noopener noreferrer">卓易通常见问题</a> · <a href="https://consumer.huawei.com/cn/support/content/zh-cn16048495/" target="_blank" rel="noopener noreferrer">华为文件选择说明</a> · <a href="https://consumer.huawei.com/cn/support/content/zh-cn16071232/" target="_blank" rel="noopener noreferrer">华为文件位置说明</a></p>
  </section>;
}
