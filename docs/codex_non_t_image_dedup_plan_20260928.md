# 非 T 历史图片去重清单（2026-09-28）

本清单按 `docs/codex_non_t_image_manifest_20260928.csv` 的 SHA-256 结果生成，并记录本轮清理执行结果。

## 核对结果

- 哈希清单覆盖 572 张 PNG/JPG/JPEG，包含 266 个不同 SHA-256 值；共有 108 个哈希重复组。
- 其中 300 张属于测试/截图输出范围；排除了 Android 源码资源、设计稿资产、已注册 worktree 和未注册源码副本。
- 只有同 SHA-256 且同文件名的测试截图才进入去重组。保留文档/脚本中出现路径或文件名引用的截图。
- 已清除 19 个精确重复路径，共 18,985,074 字节；每个路径对应的保留截图均已复核。
- 其余图片路径逐项列在 CSV 中，当前判定为保留：553 行。文本引用扫描了 224 个文本文件（1,611,170 个字符）。

## 保留的代表截图路径

- `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`（SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`）
- `release\codex_v301_build_20260928\checks\rank\codex_rank_2.png`（SHA-256 `C1C8AD835E88444D1815556C3C1B71C38C2A55F75C992CC5DAB135C4C4BD9736`）
- `release\codex_v301_build_20260928\checks\rank\codex_rank_3.png`（SHA-256 `B33CEFB64FAD3961FB6540DC5C203BC65B6D29978E43E163210F946455EF3221`）
- `release\codex_validation_locked_final_20260922\rank\codex_rank_2.png`（SHA-256 `F9547436081E90A03E25D699DE7E60623E872D8D80E99600504DB754EF14EBA5`）
- `release\codex_validation_locked_final_20260922\rank\codex_rank_3.png`（SHA-256 `54546E876C0C4D79146CF1AA47371C3D369E6A179B70CB59F4E4E40DA415ABB0`）

## 已删除的精确重复路径

- `release\codex_audit_v29_20260916\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_audit_v29_20260916\rank\codex_rank_2.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_2.png`；SHA-256 `F9547436081E90A03E25D699DE7E60623E872D8D80E99600504DB754EF14EBA5`；1,000,429 字节。
- `release\codex_audit_v29_20260916\rank\codex_rank_3.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_3.png`；SHA-256 `54546E876C0C4D79146CF1AA47371C3D369E6A179B70CB59F4E4E40DA415ABB0`；1,005,099 字节。
- `release\codex_v29_rank_qa\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_v29_rank_qa\codex_rank_2.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_2.png`；SHA-256 `F9547436081E90A03E25D699DE7E60623E872D8D80E99600504DB754EF14EBA5`；1,000,429 字节。
- `release\codex_v29_rank_qa\codex_rank_3.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_3.png`；SHA-256 `54546E876C0C4D79146CF1AA47371C3D369E6A179B70CB59F4E4E40DA415ABB0`；1,005,099 字节。
- `release\codex_v30_release_20260925\checks\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_v30_release_20260925\checks\rank\codex_rank_2.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_2.png`；SHA-256 `C1C8AD835E88444D1815556C3C1B71C38C2A55F75C992CC5DAB135C4C4BD9736`；999,925 字节。
- `release\codex_v30_release_20260925\checks\rank\codex_rank_3.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_3.png`；SHA-256 `B33CEFB64FAD3961FB6540DC5C203BC65B6D29978E43E163210F946455EF3221`；1,002,808 字节。
- `release\codex_validation_2026-09-21T14-50-48-153Z\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_validation_2026-09-21T14-50-48-153Z\rank\codex_rank_2.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_2.png`；SHA-256 `F9547436081E90A03E25D699DE7E60623E872D8D80E99600504DB754EF14EBA5`；1,000,429 字节。
- `release\codex_validation_2026-09-21T14-50-48-153Z\rank\codex_rank_3.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_3.png`；SHA-256 `54546E876C0C4D79146CF1AA47371C3D369E6A179B70CB59F4E4E40DA415ABB0`；1,005,099 字节。
- `release\codex_validation_2026-09-26T17-25-17-653Z\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_validation_2026-09-26T17-25-17-653Z\rank\codex_rank_2.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_2.png`；SHA-256 `C1C8AD835E88444D1815556C3C1B71C38C2A55F75C992CC5DAB135C4C4BD9736`；999,925 字节。
- `release\codex_validation_2026-09-26T17-25-17-653Z\rank\codex_rank_3.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_3.png`；SHA-256 `B33CEFB64FAD3961FB6540DC5C203BC65B6D29978E43E163210F946455EF3221`；1,002,808 字节。
- `release\codex_validation_final_20260922\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。
- `release\codex_validation_final_20260922\rank\codex_rank_2.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_2.png`；SHA-256 `F9547436081E90A03E25D699DE7E60623E872D8D80E99600504DB754EF14EBA5`；1,000,429 字节。
- `release\codex_validation_final_20260922\rank\codex_rank_3.png` → 保留 `release\codex_validation_locked_final_20260922\rank\codex_rank_3.png`；SHA-256 `54546E876C0C4D79146CF1AA47371C3D369E6A179B70CB59F4E4E40DA415ABB0`；1,005,099 字节。
- `release\codex_validation_locked_final_20260922\rank\codex_rank_1.png` → 保留 `release\codex_v301_build_20260928\checks\rank\codex_rank_1.png`；SHA-256 `C9A9EFCDCDB68E028129CA526B676C188AB68A62DD88FA34A32346A16E9DBE5A`；993,928 字节。

## 受保护范围与判定规则

- Android `app/src/main/res` 图片、注册中的 Git worktree 图片和两个未注册 worktree 源码副本全部保留，不列入截图删除路径。
- `docs/designs` 中非 QA/测试路径的设计稿图片保留。
- 项目文本、脚本及测试结果中的相对路径或文件名命中时保留该截图。扫描排除了哈希清单自身、构建缓存、`node_modules`、`.git`、AVD 和大于 2 MiB 的文本文件。
- 对无引用的同哈希同名截图，按文件修改时间最新者保留；时间相同则按路径字典序保留。不同文件名的同哈希文件不做删除建议。
- CSV 每行对应哈希清单中的一个路径，含决策、保留路径、理由及 SHA-256。

19 个列出的重复截图已删除；清理后 19/19 个保留副本哈希匹配，19/19 个删除路径均不存在。
