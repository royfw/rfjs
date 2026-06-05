# GITLAB_CI.md — 部署與發佈設定參考

本檔說明 **rfjs** monorepo 的 CI/CD 設定:程式碼在 GitHub,部署與 npm 發佈都跑在 **GitLab CI**(透過鏡像橋接)。內容對應 `.gitlab-ci.yml` 與 `.github/workflows/trigger-gitlab-pipeline.yml` 的現況。

> 權威來源:devops-toolkit `docs/devops-configure/`(`deploy-toolkit-reference.md`、`github-sync-reference.md`)。

---

## 1. 專案概覽

| 項目 | 值 |
|------|----|
| 型態 | Monorepo(`apps/*` + `packages/*` + `libs/*`,Turborepo) |
| 套件管理 | `pnpm@10.24.0` |
| Build tool | Turbo(`turbo build`) |
| 部署目標 | Kubernetes(GitLab + devops-toolkit `nodejs-monorepo.yml`) |
| npm 發佈 | Changesets(`changesets_version_channel` + `changesets_publish`) |
| 主要產出 | `packages/@rfjs/*` 發佈到 npm;`apps/api`、`apps/orm-app` 可部署到 K8s |

---

## 2. 部署拓撲(GitHub → GitLab 橋接)

```
GitHub repo (royfw/rfjs)
└─ .github/workflows/trigger-gitlab-pipeline.yml
     push to: main / release/* / deploy/* / publish/*
     └─ royfw/gitlab-sync-action@v1
          鏡像分支 → GitLab project royfw/apps/rfjs (id 5)
          └─ 在 GitLab 跑 .gitlab-ci.yml(version / docker_build / deploy_trigger / publish)
```

- **單一事實來源是 GitLab**。先前重複的 GitHub-native CD workflow(`cd-version-release*`、`cd-publish-npmjs`、`cd-npm-release`、`cd-deploy-dev`)已移除,避免「同一個 PR 同時被 GitHub 與 GitLab 各跑一次版本/發佈」造成雙重 commit / 雙重 publish。
- GitHub 端只保留 `trigger-gitlab-pipeline.yml` 作為橋接。

---

## 3. CI Pipeline Jobs

| Job | Stage | 觸發分支 | 動作 |
|-----|-------|----------|------|
| `version_release` | `version` | `release/stable\|alpha\|beta\|rc`(push) | `changeset version`,依分支設定 `CHANNEL`,`PUSH_VERSION=true` 把版本 commit 推回 release 分支 |
| `publish_npmjs` | `publish` | `publish/npmjs`(push,**manual** 手動觸發) | `changeset publish` 發佈到 npm,`PUSH_TAGS=true`,`CHANNEL=auto`(由來源分支推導) |
| `detect_project` | `deploy_trigger` | `deploy/dev` | 偵測異動 app、build image 推 Harbor、產生動態 child pipeline |
| `trigger_project` | `deploy_trigger` | `deploy/dev` | 觸發動態 child pipeline,執行 Helm 部署 |

> `docker_build` stage 由 devops-toolkit 的動態 child pipeline 使用。

---

## 4. npm 發佈流程(主要工作流程)

發佈是**兩段式**:先在 `release/*` 算版本,再到 `publish/npmjs` 實際 publish。

```
1. 建立 changeset
   pnpm changeset:add        # 選套件 + bump 等級,commit 進 main

2. 版本(version)
   merge → release/stable    # 正式版
   或 merge → release/alpha|beta|rc   # 預發版
   → GitLab version_release:跑 changeset version、產生 CHANGELOG、把版本 commit 推回該 release 分支

3. 發佈(publish)
   merge → publish/npmjs
   → GitLab publish_npmjs(手動點擊執行)→ changeset publish 到 npm + 推 git tag
```

### 目前發佈集合(`pnpm changeset:status`)

| 套件 | bump | 目前版本 |
|------|------|----------|
| `@rfjs/data-filter` | minor | `0.0.0` |
| `@rfjs/data-transform` | minor | `0.0.0` |
| `@rfjs/mongo-query` | minor | `0.0.0` |
| `@rfjs/jwt` | minor | `0.0.0` |
| `@rfjs/retry` | minor | `0.0.0` |
| `@rfjs/object-utils` | minor | `0.0.0` |
| `@rfjs/pg-toolkit` | patch | `0.0.8` |
| `@rfjs/tpl-toolkit` | patch | `0.0.1` |
| `@rfjs/jsonb-query` | — | **held back**(見下) |

- **不在 pre-release 模式**(無 `.changeset/pre.json`):`release/stable` 出的是正式版。
- 所有 9 個套件 `publishConfig.access: "public"`,scoped package 會公開發佈。
- `@rfjs/jsonb-query` 在 `.changeset/config.json` 的 `ignore` 清單中,Phase 2(object/array 支援)完成前不發佈。

---

## 5. 部署流程(deploy/dev,scaffold 狀態)

```
merge → deploy/dev
→ GitLab detect_project + trigger_project(DEPLOY_ENV=royfw-dev, namespace=rfjs-dev)
```

- ⚠️ **目前 `.deploy/` overlay 尚未建立**。`apps/api`、`apps/orm-app` 有 Dockerfile,會 build image 推 Harbor,但因為缺 `.deploy/env/royfw-dev/helm/{api,orm-app}.yaml`,部署階段會 `[skip-deploy]`(除非 devops-toolkit repo 的 `projects/royfw/apps/rfjs/` 有 fallback 設定)。
- `deploy/prod` 目前**未接線**(routing 已收斂成只認 `deploy/dev`,避免誤部署到 dev namespace)。
- `apps/web`(Next.js)無 Dockerfile,不在 monorepo build/deploy 範圍內。

要啟用實際部署,參考第 8 節「待辦」。

---

## 6. GitLab CI Variables(在 GitLab > Settings > CI/CD > Variables 設定)

| 變數 | 類型 | Masked | 用途 | 狀態 |
|------|------|--------|------|------|
| `ROYFW_KUBECONFIG` | file / variable | — | K8s kubeconfig(`detect/trigger` 使用) | `.gitlab-ci.yml` 明確引用 |
| `HARBOR_TOKEN` | variable | yes | Harbor registry 推 image | toolkit 需要 |
| `DEVOPS_CI_REPO_TOKEN` | variable | yes | clone `shared/devops-toolkit` 的 GitLab OAuth token | toolkit 需要 |
| `NPM_TOKEN` | variable | yes | npm publish 認證(`publish_npmjs`) | toolkit 需要 |
| git push token | variable | yes | version_release `PUSH_VERSION` / publish `PUSH_TAGS` 推回 repo 用 | 確認 devops-toolkit 實際變數名 |

> 後三項的確切變數名以 devops-toolkit 模板為準;若 pipeline 報認證/權限錯,優先檢查這幾個。

---

## 7. GitHub Secrets(橋接用,在 GitHub > Settings > Secrets)

`trigger-gitlab-pipeline.yml` 需要:

| Secret | 用途 |
|--------|------|
| `GITLAB_PUSH_HOST` | GitLab 推送 host |
| `GITLAB_API_TOKEN` | 鏡像 push + 讀 pipeline 狀態 |
| `GITLAB_TRIGGER_TOKEN` | 觸發 GitLab pipeline |

---

## 8. 環境

| 環境 | 部署分支 | DEPLOY_ENV | Namespace | KUBECONFIG | 狀態 |
|------|----------|------------|-----------|------------|------|
| dev | `deploy/dev` | `royfw-dev` | `rfjs-dev` | `ROYFW_KUBECONFIG` | 已接線(待補 overlay) |
| prod | (未接線) | — | — | — | 未設定 |

---

## 9. 待辦 / Pending

1. **建立 `.deploy/env/royfw-dev/helm/` overlay**:`api.yaml`、`orm-app.yaml`(`kind: Deployment` + `containerPort: 3000` + `secrets.existingSecretName`),deploy 才會真正生效。
2. **Secrets**:`.deploy/env/royfw-dev/env_files/secret.env.files`;`orm-app` 連 4 種 DB,`.env.example` 需補 `DATABASE_URL` 等實際變數。
3. **prod 環境**:要部署 prod 需新增 `.deploy/env/{prod-env}/`、prod kubeconfig/namespace,並在 `detect/trigger` rules 加 `deploy/prod` 路由。
4. **jsonb-query**:Phase 2(object/array)完成後,從 `.changeset/config.json` 的 `ignore` 移除即可納入發佈。

---

## 10. 設定調整指南

| 想改什麼 | 改哪裡 |
|----------|--------|
| 加新套件到發佈 | `pnpm changeset:add` → merge `release/*` → merge `publish/npmjs` |
| 暫不發佈某套件 | `.changeset/config.json` 的 `ignore` |
| 改 replica / resources / ingress | `.deploy/env/{ENV}/helm/{service}.yaml`(待建立) |
| 加 secrets | `.deploy/env/{ENV}/env_files/secret.env.files` + GitLab CI Variables |
| 改部署分支路由 | `.gitlab-ci.yml` 的 `detect_project` / `trigger_project` rules |
| 加新部署環境 | `.deploy/env/` 新目錄 + `.gitlab-ci.yml` 路由 |
| 改鏡像同步分支 | `.github/workflows/trigger-gitlab-pipeline.yml` 的 `on.push.branches` |

---

## 11. Troubleshooting

| 症狀 | 原因 | 處理 |
|------|------|------|
| npm publish 報 `version already exists` | 版本已發過,或仍有殘留的重複發佈路徑 | 確認 GitHub-native CD 已移除;只用 GitLab `publish_npmjs` |
| `CreateContainerConfigError` | Secret 不存在 | 檢查 `.deploy/env/{ENV}/env_files/` 設定 |
| `ImagePullBackOff` / `denied` | Harbor token 錯、image 未建、namespace 缺 pull secret | 檢查 `HARBOR_TOKEN`、確認 build 成功、`imagePullSecrets` 對齊 |
| Helm upgrade 失敗 | kubeconfig 失效 | 檢查 `ROYFW_KUBECONFIG` |
| detect 找不到 app 異動 | overlay 未建立 → `[skip-deploy]` | 建立 `.deploy/env/royfw-dev/helm/{service}.yaml` |
| version 推不回去 | git push token 權限不足 | 檢查第 6 節 git push token |

---

## 12. Branch Protection 建議(請團隊評估)

| 分支 | 建議 |
|------|------|
| `main` | 禁止直接 push,PR 合併;必過 CI |
| `release/*` | 限維護者合併;合併即觸發 version |
| `publish/npmjs` | 限維護者合併;發佈為 manual gate,需人工點擊 |
| `deploy/dev` | 限維護者合併;合併即部署 |

---

<!-- 由 devops-configure 技能稽核生成;對應 .gitlab-ci.yml 與 trigger-gitlab-pipeline.yml 現況。 -->
