# Contributing to ReflexLearn

感谢你关注 ReflexLearn。这个仓库仍处于原型到产品化之间，最有价值的贡献通常是让行为更容易复现、验证和维护。

## 适合开始的任务

- 为 orchestration、RAG 或安全边界补充最小测试
- 增加评测 case、人工标注和可重复的对比报告
- 改进英文 README、架构说明和启动排障文档
- 修复输入校验、任务状态、失败恢复和权限边界问题

## 提交前检查

所有运行、调试和测试优先通过 `scripts/` 下的脚本完成。一个典型的本地检查流程：

```bash
bash scripts/test_unit.sh
bash scripts/check_api.sh
bash -n scripts/*.sh
```

如果改动涉及真实中间件、LLM 或评测，请在 PR 中写明：

- 使用的配置和数据范围
- 运行的完整命令
- 结果、失败样例和已知限制

## Pull request 约定

1. 一个 PR 只解决一个问题，避免混入无关格式化或重命名。
2. PR 标题使用动词开头，例如 `Add ...`、`Fix ...`、`Document ...`。
3. 描述中说明动机、实现边界、验证方式和潜在回归风险。
4. 不要提交密钥、真实用户数据、模型输出中的隐私信息或大型生成文件。

## 安全问题

请不要在公开 issue 中披露可利用的安全漏洞。使用 GitHub Security Advisories 或私下联系维护者。
