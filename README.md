# 返潮

俯视2D交互叙事原型。玩家在持续计时的洪水故事中，用自然语言执行预制情境行动，与能裁剪过去、承诺未来的旁白争夺剩余历史空间。

## 运行

```powershell
node server.mjs
```

打开 `http://127.0.0.1:4173`。最终部署为静态网页，玩家不需要安装本地服务。浏览器小模型只从预制合法动作/旁白操作中选择编号；规则引擎拥有最终裁决权。

## 验证

```powershell
node --test tests/*.test.mjs
node scripts/audit-routes.mjs
```

攻略、全部操作点、27条大路径和有向关系图位于 `guide.html`。
