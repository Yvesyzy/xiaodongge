#!/usr/bin/env bash
# 检测本机到 GitHub 的 git 写通道是否可用。
# 背景：本机存在多个代理配置，git 读（ls-remote/GET）常通而写（push/POST）不通，
# 且失败形态多样（无限挂起 / 502 / server closed abruptly / 超时），
# 每次重试要浪费十几分钟。此脚本一次性给出结论。
#
# 用法：bash scripts/codex_check_push_channel.sh
# 退出码：0=可推送  1=不可推送（附原因与建议）

set -u

PROBE_TIMEOUT=25

echo "=== GitHub 写通道检测 ==="
echo

# 1. 列出所有代理来源
echo "[1/4] 代理配置来源"
ENV_PROXY="${https_proxy:-${HTTPS_PROXY:-${HTTP_PROXY:-${http_proxy:-}}}}"
GIT_GLOBAL="$(git config --global --get http.proxy 2>/dev/null || echo '')"
GIT_LOCAL="$(git config --local --get http.proxy 2>/dev/null || echo '')"
echo "  环境变量 : ${ENV_PROXY:-<无>}"
echo "  git 全局 : ${GIT_GLOBAL:-<无>}"
echo "  git 仓库 : ${GIT_LOCAL:-<无>}"
if [ "$ENV_PROXY" != "$GIT_GLOBAL" ] && [ -n "$GIT_GLOBAL" ]; then
  echo "  ⚠ 环境变量与 git 全局代理不一致，git 优先用自己的配置"
fi
echo

# 2. 代理端口是否在监听
echo "[2/4] 代理端口监听状态"
for p in $(printf '%s\n%s\n%s\n' "$ENV_PROXY" "$GIT_GLOBAL" "$GIT_LOCAL" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+' | cut -d: -f2 | sort -u); do
  if netstat -ano 2>/dev/null | grep -q "127.0.0.1:$p .*LISTENING"; then
    echo "  :$p  LISTENING"
  else
    echo "  :$p  ✗ 未监听（git 走它必然挂死）"
  fi
done
[ -z "$(printf '%s' "$ENV_PROXY$GIT_GLOBAL$GIT_LOCAL" | grep -oE '[0-9]+' | head -1)" ] && echo "  <无代理配置>"
echo

# 3. 读通道（通常通，仅作基线）
echo "[3/4] 读通道 git ls-remote"
if timeout $PROBE_TIMEOUT git ls-remote --heads origin main >/dev/null 2>&1; then
  echo "  ✓ 读通（GET 可用，不代表能推）"
  READ_OK=1
else
  echo "  ✗ 读也不通（网络完全不可达）"
  READ_OK=0
fi
echo

# 4. 写通道 dry-run（关键判定）
echo "[4/4] 写通道 git push --dry-run"
echo "  探测中（最多 ${PROBE_TIMEOUT}s）..."
DRY_OUT="$(timeout $PROBE_TIMEOUT git push --dry-run origin main 2>&1)"
DRY_CODE=$?
if [ $DRY_CODE -eq 0 ]; then
  echo "  ✓ 写通，可以直接 git push origin main"
  exit 0
fi

DRY_MSG="$(printf '%s' "$DRY_OUT" | tr '\r' '\n' | grep -v '^$' | tail -1)"
echo "  ✗ 写不通（退出码 $DRY_CODE）"
echo "  报错: ${DRY_MSG:-<无输出，典型的代理挂死>}"
echo

echo "=== 结论 ==="
if [ $DRY_CODE -eq 124 ] || [ -z "$DRY_MSG" ]; then
  echo "  形态：挂死无输出 → 代理接受 CONNECT 但不转发数据"
  echo "  建议：git 走的是已失效的代理端口。换网络环境，或更新 git 代理配置："
  echo "        git config --global http.proxy  <可用代理>"
  echo "        git config --global https.proxy <可用代理>"
elif printf '%s' "$DRY_MSG" | grep -q "502"; then
  echo "  形态：CONNECT 隧道 502 → 代理拒绝该目标"
  echo "  建议：当前代理不通 GitHub，需换出口或改用 SSH remote"
elif printf '%s' "$DRY_MSG" | grep -q "server closed abruptly"; then
  echo "  形态：TLS 被服务器中断 → 代理对长连接不稳定"
  echo "  建议：尝试 git -c http.sslBackend=openssl，或减少单次推送体积"
elif printf '%s' "$DRY_MSG" | grep -q "Could not connect"; then
  echo "  形态：直连失败 → 无可用出口"
  echo "  建议：确认网络/代理已恢复"
else
  echo "  建议：按上方报错信息排查"
fi
echo
echo "提交本身是安全的，只是没到远端。恢复后执行：git push origin main"
exit 1
