# Task: 修复 TerminalView 空白与 xterm dimensions 崩溃

负责人：`@opencode`

目标：Current Host Terminal 的 websocket 已经连通，但前端 terminal 仍然空白，并持续报错：

```text
Cannot read properties of undefined (reading 'dimensions')
```

这轮不要再做体验优化，先把 terminal 恢复为**最小稳定可显示版本**。

---

## 0. 当前明确问题

### 当前现象

1. `/terminal` 显示已连接，但终端区域空白
2. 浏览器控制台持续报错：

```text
Cannot read properties of undefined (reading 'dimensions')
```

3. websocket 已经能连上，所以当前阻塞点不在后端 session，而在前端 `xterm` 渲染/viewport 生命周期

### 当前高风险来源

重点文件：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/components/terminal/TerminalView.tsx`

当前文件里仍然保留了这些高风险逻辑：

- `@xterm/addon-fit`
- `fitAddon.fit()`
- `ResizeObserver`
- 基于 `terminal.cols/rows` 的前端 resize 同步

这些逻辑与当前报错高度相关，应先全部移除，回退到最小稳定版本。

---

## 1. 本轮只做什么

1. **彻底移除 `TerminalView.tsx` 里的 `FitAddon` 相关逻辑**
2. **彻底移除 `ResizeObserver` 和自动 fit/resize 逻辑**
3. **保留最小 terminal 功能：open / output / input / close**
4. **验证终端不再空白，且不再报 `dimensions` 错误**
5. **做一次构建与手工验证**

---

## 2. 本轮不要做什么

1. **不要继续打磨宝塔风格体验**
2. **不要继续调 shell banner / welcome message**
3. **不要做复杂 resize 自适应**
4. **不要引入新的 xterm addon**
5. **不要改动后端 terminal service 架构**
6. **不要再尝试“修一点 fit”**，本轮目标是先完全去掉 fit 路径

---

## 3. 必须修改的点

## 3.1 移除 FitAddon

文件：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/components/terminal/TerminalView.tsx`

要求：

- 删除 `@xterm/addon-fit` import
- 删除 `fitAddonRef`
- 删除 `terminal.loadAddon(fitAddon)`
- 删除所有 `fitAddon.fit()` 调用
- 删除任何 `requestAnimationFrame(() => fitAddon.fit())`

目标：

- terminal 初始化只保留 `new Terminal(...)` + `terminal.open(...)`

## 3.2 移除 ResizeObserver

文件：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/components/terminal/TerminalView.tsx`

要求：

- 删除 `ResizeObserver`
- 删除 observer callback 中所有 terminal fit/resize 行为
- 删除 observer cleanup

目标：

- 避免 xterm viewport 在未稳定时反复刷新

## 3.3 移除前端 resize 同步

文件：

- `/Users/luoxiang/workspace/bull/console/dashboard/src/components/terminal/TerminalView.tsx`

要求：

- 删除 websocket `onopen` 时基于 `terminal.cols/rows` 发送的 resize 消息
- 删除任何基于 `terminal.cols` / `terminal.rows` 的自动 resize 上报

说明：

- 本轮允许终端先用默认尺寸运行
- 等最小版本稳定后，再考虑恢复 resize

## 3.4 保留最小 terminal 能力

`TerminalView.tsx` 需要保留的只有：

1. 创建 `Terminal`
2. `terminal.open(container)`
3. websocket 建立
4. 后端 `output` -> `terminal.write(...)`
5. `terminal.onData(...)` -> websocket `input`
6. `exit/error` 状态处理
7. 页面卸载时关闭 websocket 和 dispose terminal

目标：

- 先证明 terminal 能稳定显示和交互

## 3.5 可顺手清理未使用 props/状态

如果 `status` 等 props 在 `TerminalView.tsx` 中已不再实际使用，可顺手清理未使用项，避免误导。

但要求：

- 不要扩大改动范围
- 只做与当前 terminal 稳定性直接相关的小清理

---

## 4. 验证要求

## 4.1 构建验证

执行：

```bash
cargo check
cd /Users/luoxiang/workspace/bull/console/dashboard && pnpm build
```

## 4.2 手工验证

至少验证：

1. 打开 `/terminal` 后终端区域不再空白
2. 浏览器控制台不再出现：

```text
Cannot read properties of undefined (reading 'dimensions')
```

3. 能看到当前主机 shell prompt
4. 可以执行：
   - `pwd`
   - `ls`
   - `echo hello`
5. 点击断开后可再次连接
6. 刷新页面后仍能再次进入 terminal

---

## 5. 验收标准

完成标准：

1. `TerminalView.tsx` 中已彻底去除 `FitAddon`
2. `TerminalView.tsx` 中已彻底去除 `ResizeObserver`
3. 不再基于前端 `terminal.cols/rows` 自动发 resize
4. `/terminal` 不再空白
5. 浏览器控制台不再报 `dimensions` 错误
6. `cargo check` 通过
7. `pnpm build` 通过
8. 基本命令可交互执行

---

## 6. 最终目标一句话

先把 Current Host Terminal 收敛为一个**最小稳定可显示、可交互**的版本，彻底绕开当前 `xterm fit/viewport` 崩溃问题；体验优化留到后续单独处理。
