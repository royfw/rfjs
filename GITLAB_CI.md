# GITLAB_CI.md — 部署與發佈設定參考

本檔說明 **rfjs** monorepo 的 CI/CD 設定:程式碼在 GitHub,**版本與 npm 發佈跑在 GitHub Actions**,**K8s 部署跑在 GitLab CI**(透過鏡像橋接)。內容對應 `.github/workflows/*` 與 `.gitlab-ci.yml` 的現況。

> 權威來源:devops-toolkit `docs/devops-configure/`(`deploy-toolkit-reference.md`、`github-sync-reference.md`)。

---

## 1. 專案概覽

| 項目 | 值 |
|------|----|
| 型態 | Monorepo(`apps/*` + `packages/*` + `libs/*`,Turborepo) |
| 套件管理 | `pnpm@10.24.0` |
| Build tool | Turbo(`turbo build`) |
| 部署目標 | Kubernetes(GitLab + devops-toolkit `nodejs-monorepo.yml`) |
| 版本 / npm 發佈 | Changesets,跑在 GitHub Actions(`cd-version-release*.yml` / `cd-publish-npmjs.yml`) |
| 主要產出 | `packages/@rfjs/*` 發佈到 npm;`apps/api` 可部署到 K8s |

---

## 2. 部署拓撲(GitHub → GitLab 橋接)

```
GitHub repo (royfw/rfjs)
├─ .github/workflows/cd-version-release*.yml   ← 版本(changeset version)
│     PR merged → release/stable|alpha|beta|rc
│     └─ uses royfw/rf-devops/.github/workflows/_changesets-version-channel-turbo.yml
│          → changeset version、push 回 release/*、開 PR 回 main
├─ .github/workflows/cd-publish-npmjs.yml      ← npm 發佈(手動 workflow_dispatch)
│     Run workflow(ref=publish/npmjs)→ changeset publish → npm + tag
└─ .github/workflows/trigger-gitlab-pipeline.yml   ← 橋接(只為了 deploy)
     push to: main / release/* / deploy/*
     └─ royfw/gitlab-sync-action@v1
          鏡像分支 → GitLab project royfw/apps/rfjs (id 5)
          ├─ main / release/*   → 只鏡像,不觸發 pipeline(mirror-only)
          └─ deploy/*           → 鏡像 + 觸發 + 等待 .gitlab-ci.yml
                                   (docker_build / deploy_trigger)
```

- **責任分工:GitHub 管 version + npm publish,GitLab 只管 K8s deploy。**
  - **版本**在 GitHub Actions 算(merge 進 `release/*` 觸發),版本 commit 直接落在 GitHub、並自動開 PR 回 `main`。
  - **npm publish** 在 GitHub Actions(`cd-publish-npmjs.yml`,手動 `workflow_dispatch`)。改放 GitHub 的原因見第 4 節。
  - **K8s deploy** 留在 GitLab(需要 `KUBECONFIG`)。
- **mirror-only 分支**:`.gitlab-ci.yml` 只剩 `deploy/dev` 有 job;`main` 與 `release/*` 在 GitLab 沒有任何 job(觸發會回 `400 "No stages / jobs"`)。因此 bridge 以 `trigger_pipeline: ${{ startsWith(ref,'deploy/') }}` 只對 deploy 觸發,其餘 mirror-only。publish 不再經過 GitLab。
- rf-devops 正搬遷進 `github-toolkit`;version caller 之後會 repoint 到 github-toolkit。

---

## 3. CI Pipeline Jobs

| Job | Stage | 觸發分支 | 動作 |
|-----|-------|----------|------|
| `detect_project` | `deploy_trigger` | `deploy/dev` | 偵測異動 app、build image 推 Harbor、產生動態 child pipeline |
| `trigger_project` | `deploy_trigger` | `deploy/dev` | 觸發動態 child pipeline,執行 Helm 部署 |

> 版本(`changeset version`)**不在 GitLab**;由 GitHub Actions `cd-version-release*.yml` 處理(見第 2 節)。
> `docker_build` stage 由 devops-toolkit 的動態 child pipeline 使用。

---

## 4. npm 發佈流程(主要工作流程)

版本與發佈**都在 GitHub Actions**:先在 `release/*` 算版本,再用 `publish/npmjs` 發佈。

> **為什麼 publish 在 GitHub 不在 GitLab**:devops-toolkit 的 GitLab publish job 用 `changeset status` 當守門員,但 `changeset version` 跑完會消耗 changeset,導致 `changeset status` 在已版本化的分支回報「沒有 release」→ 跳過發佈。原生 `changeset publish` 沒有這個守門員(它比對 package.json 版本 vs npm),所以 publish 改用 GitHub Actions 的 `cd-publish-npmjs.yml`。`@rfjs/jsonb-query` 以 `"private": true` hold 住(這是 `changeset publish` 唯一認的排除方式;`ignore` 擋不住 publish)。

```
1. 建立 changeset
   pnpm changeset:add        # 選套件 + bump 等級,commit 進 main

2. 版本(version)— GitHub Actions
   開 PR: main → release/stable(正式版)或 release/alpha|beta|rc(預發),merge
   → cd-version-release*.yml 跑 changeset version、產生 CHANGELOG、
     push 版本 commit 回該 release 分支,並自動開 PR 回 main(merge 後 main 同步版本)

3. 發佈(publish)— GitHub Actions
   把版本化後的狀態 merge/push → publish/npmjs
   → Actions 分頁 → "CD NPM Publish" → Run workflow(ref 預設 publish/npmjs、channel 預設 stable)
   → changeset publish 到 npm + 推 git tag 回 GitHub
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

- ⚠️ **目前 `.deploy/` overlay 尚未建立**。`apps/api` 有 Dockerfile,會 build image 推 Harbor,但因為缺 `.deploy/env/royfw-dev/helm/api.yaml`,部署階段會 `[skip-deploy]`(除非 devops-toolkit repo 的 `projects/royfw/apps/rfjs/` 有 fallback 設定)。
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


> 後三項的確切變數名以 devops-toolkit 模板為準;若 pipeline 報認證/權限錯,優先檢查這幾個。

---

## 7. GitHub Secrets(在 GitHub > Settings > Secrets)

| Secret | 用途 | 被誰用 |
|--------|------|--------|
| `GIT_TOKEN` | checkout / push 版本 commit / 推 tag / 開 PR(PAT,需能 push `release/*`) | `cd-version-release*.yml`、`cd-publish-npmjs.yml` |
| `NPM_TOKEN` | npm publish 認證(對 `@rfjs` scope 有發佈權) | `cd-publish-npmjs.yml` |
| `GITLAB_PUSH_HOST` | GitLab 推送 host | `trigger-gitlab-pipeline.yml` |
| `GITLAB_API_TOKEN` | 鏡像 push + 讀 pipeline 狀態 | `trigger-gitlab-pipeline.yml` |
| `GITLAB_TRIGGER_TOKEN` | 觸發 GitLab pipeline | `trigger-gitlab-pipeline.yml` |

---

## 8. 環境

| 環境 | 部署分支 | DEPLOY_ENV | Namespace | KUBECONFIG | 狀態 |
|------|----------|------------|-----------|------------|------|
| dev | `deploy/dev` | `royfw-dev` | `rfjs-dev` | `ROYFW_KUBECONFIG` | 已接線(待補 overlay) |
| prod | (未接線) | — | — | — | 未設定 |

---

## 9. 待辦 / Pending

1. **建立 `.deploy/env/royfw-dev/helm/` overlay**:`api.yaml`(`kind: Deployment` + `containerPort: 3000` + `secrets.existingSecretName`),deploy 才會真正生效。
2. **Secrets**:`.deploy/env/royfw-dev/env_files/secret.env.files`;`api` 需要的 `DATABASE_URL` 等實際變數需補。
3. **prod 環境**:要部署 prod 需新增 `.deploy/env/{prod-env}/`、prod kubeconfig/namespace,並在 `detect/trigger` rules 加 `deploy/prod` 路由。
4. **jsonb-query**:Phase 2(object/array)完成後,從 `.changeset/config.json` 的 `ignore` 移除即可納入發佈。

---

## 10. 設定調整指南

| 想改什麼 | 改哪裡 |
|----------|--------|
| 加新套件到發佈 | `pnpm changeset:add` → merge `release/*`(GitHub 算版本)→ merge `publish/npmjs` → Run workflow 「CD NPM Publish」 |
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
| npm publish 報 `version already exists` | 版本已發過 | `changeset publish` 會自動跳過已存在版本;通常無害。若要重發需 bump 版本 |
| `CD NPM Publish` 報 `ENEEDAUTH` / `401` | GitHub 缺 `NPM_TOKEN` 或無 `@rfjs` 發佈權 | 在 GitHub Settings → Secrets 設定 `NPM_TOKEN` |
| `CD NPM Publish` 顯示沒發任何套件 | 該分支版本與 npm 上相同(無未發版本) | 確認 `publish/npmjs` 帶的是版本化後的狀態(`release/*` 已算過版本) |
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
